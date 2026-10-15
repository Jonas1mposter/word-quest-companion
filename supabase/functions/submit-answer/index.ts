import { isAnswerCorrect } from "../_shared/answerMatch.ts";
import { analyzeTiming, analyzeLookup, LOOKUP_MIN_SAMPLES } from "../_shared/answerTiming.ts";
import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

// Submit an answer for a ranked/free/2v2 match. Server-validates correctness
// against the stored words[] payload. Updates the player's (or team's) score atomically.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { matchId, questionIndex, answer, quizType, elapsedMs } = await req.json();

    if (typeof matchId !== "string" || typeof questionIndex !== "number") {
      return json({ error: "Bad request" }, 400);
    }

    const { data: match, error: mErr } = await admin
      .from("ranked_matches")
      .select("id, player1_id, player2_id, player3_id, player4_id, player1_score, player2_score, team1_score, team2_score, words, status, match_type, mode")
      .eq("id", matchId)
      .single();
    if (mErr || !match) return json({ error: "Match not found" }, 404);
    if (match.status === "completed") return json({ ok: true, matchEnded: true, isCorrect: false }, 200);

    const isP1 = match.player1_id === profile.id;
    const isP2 = match.player2_id === profile.id;
    const isP3 = match.player3_id === profile.id;
    const isP4 = match.player4_id === profile.id;
    if (!isP1 && !isP2 && !isP3 && !isP4) return json({ error: "Not in match" }, 403);

    const words = (match.words as any[]) || [];
    const word = words[questionIndex];
    if (!word) return json({ error: "Bad question" }, 400);

    let isCorrect = false;
    const norm = (s: any) => String(s ?? "").trim().toLowerCase();
    switch (quizType) {
      case "meaning":
        isCorrect = norm(answer) === norm(word.meaning); break;
      case "reverse":
      case "spelling":
      case "listening":
        isCorrect = isAnswerCorrect(String(answer ?? ""), String(word.word ?? "")); break;
      default:
        isCorrect = isAnswerCorrect(String(answer ?? ""), String(word.word ?? "")) || norm(answer) === norm(word.meaning);
    }

    const { data: existing } = await admin
      .from("match_answers")
      .select("id")
      .eq("match_id", matchId)
      .eq("player_id", profile.id)
      .eq("question_index", questionIndex)
      .maybeSingle();
    if (existing) return json({ ok: true, isCorrect, duplicate: true });

    await admin.from("match_answers").insert({
      match_id: matchId,
      player_id: profile.id,
      question_index: questionIndex,
      answer: String(answer ?? ""),
      is_correct: isCorrect,
    });

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

    const isRanked = match.match_type === "ranked";
    const delta = isCorrect ? 1 : (isRanked ? -1 : 0);
    if (delta !== 0) {
      if (match.mode === "2v2") {
        // team1 = {p1, p3}, team2 = {p2, p4}
        const inTeam1 = isP1 || isP3;
        const field = inTeam1 ? "team1_score" : "team2_score";
        const current = inTeam1 ? match.team1_score : match.team2_score;
        await admin.from("ranked_matches").update({ [field]: (current ?? 0) + delta }).eq("id", matchId);
      } else {
        const field = isP1 ? "player1_score" : "player2_score";
        const newScore = (isP1 ? match.player1_score : match.player2_score) + delta;
        await admin.from("ranked_matches").update({ [field]: newScore }).eq("id", matchId);
      }
    }

    // ===== DAC：答题节奏过于固定 → 通知客户端判负（服务端结算时也会强制判负）=====
    const { data: mine } = await admin
      .from("match_answers").select("answered_at, answer, is_correct")
      .eq("match_id", matchId).eq("player_id", profile.id);
    const timing = analyzeTiming((mine ?? []) as any);
    // ===== DAC：疑似拍照/查答案（明显比平时慢却几乎全对）→ 仅记录，管理员复查 =====
    const checkAt = Math.max(LOOKUP_MIN_SAMPLES, words.length);
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
