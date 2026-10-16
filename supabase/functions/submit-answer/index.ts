import { z } from "npm:zod@3.25.76";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
const AnswerRequest = z.object({ matchId: z.string().uuid(), questionIndex: z.number().int().min(0).max(999), answer: z.string().max(2000), elapsedMs: z.number().finite().nonnegative().optional() });
import { analyzeTiming, analyzeLookup, LOOKUP_MIN_SAMPLES } from "../_shared/answerTiming.ts";
import { requireProfile, json } from "../_shared/auth.ts";

// Submit an answer for a ranked/free/2v2 match. Server-validates correctness
// against the stored words[] payload. Updates the player's (or team's) score atomically.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const body = await req.json();
    const parsed = AnswerRequest.safeParse(body);
    if (!parsed.success) return json({ error: "Bad request" }, 400);
    const { matchId, questionIndex, answer, elapsedMs } = parsed.data;
    if (profile.banned_until && new Date(profile.banned_until).getTime() > Date.now()) return json({ error: "Account banned" }, 403);
    const { data: match, error: mErr } = await admin.from("ranked_matches")
      .select("id, status, match_type, mode, question_count").eq("id", matchId).single();
    if (mErr || !match) return json({ error: "Match not found" }, 404);
    const { data: result, error: submitError } = await admin.rpc("match_submit_question", {
      p_match_id: matchId, p_profile_id: profile.id,
      p_question_index: questionIndex, p_answer: answer,
    });
    if (submitError) return json({ error: submitError.message }, 409);
    if (result?.matchEnded || result?.duplicate) return json(result);
    const isCorrect = result?.isCorrect === true;
    // ===== DAC (Dipont Anti-Cheat)：答题速度检测 =====
    // 答对且速度快到人类不可能（<1.2s）时记录可疑标记，不影响本次计分
    if (isCorrect) {
      let fastest: number | null =
        typeof elapsedMs === "number" && elapsedMs >= 0 ? elapsedMs : null;
      // 服务端口径：与上一题的作答间隔（不依赖客户端上报）
      const { data: prev } = await admin
        .from("match_answers")
        .select("answered_at")
        .eq("match_id", matchId)
        .eq("player_id", profile.id)
        .lt("question_index", questionIndex)
        .order("question_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prev?.answered_at) {
        const serverDelta = Date.now() - new Date(prev.answered_at).getTime();
        if (fastest === null || serverDelta < fastest) fastest = serverDelta;
      }
      if (fastest !== null && fastest < 1200) {
        await admin.rpc("dac_flag", {
          p_profile_id: profile.id,
          p_source: "submit-answer",
          p_reason: "impossible_answer_speed",
          p_severity: fastest < 600 ? "high" : "medium",
          p_meta: { matchId, questionIndex, elapsedMs: fastest, match_type: match.match_type, mode: match.mode },
        });
      }
    }

    // ===== DAC：答题节奏过于固定 → 通知客户端判负（服务端结算时也会强制判负）=====
    const { data: mine } = await admin
      .from("match_answers").select("answered_at, answer, is_correct")
      .eq("match_id", matchId).eq("player_id", profile.id);
    const timing = analyzeTiming((mine ?? []) as any);
    // ===== DAC：疑似拍照/查答案（明显比平时慢却几乎全对）→ 仅记录，管理员复查 =====
    const checkAt = Math.max(LOOKUP_MIN_SAMPLES, match.question_count);
    if (!timing.robotic && (mine?.length ?? 0) === checkAt) {
      try {
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: past } = await admin
          .from("match_answers").select("match_id, answered_at, answer")
          .eq("player_id", profile.id).neq("match_id", matchId)
          .gte("answered_at", since).order("answered_at", { ascending: false }).limit(400);
        const byMatch = new Map<string, any[]>();
        for (const r of past ?? []) { const a = byMatch.get(r.match_id) ?? []; a.push(r); byMatch.set(r.match_id, a); }
        const lookup = analyzeLookup((mine ?? []) as any, [...byMatch.values()]);
        if (lookup.suspicious) {
          await admin.rpc("dac_flag", {
            p_profile_id: profile.id, p_source: "submit-answer", p_reason: "suspected_answer_lookup",
            p_severity: "medium", p_meta: { matchId, ...lookup, match_type: match.match_type, mode: match.mode },
          });
        }
      } catch (_) { /* 检测失败不影响答题 */ }
    }

    if (timing.robotic) {
      return json({ ok: true, isCorrect, dacForfeit: { reason: "fixed_answer_timing", meta: timing } });
    }

    return json({ ok: true, isCorrect });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
