import { z } from "npm:zod@3.25.76";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
const AnswerRequest = z.object({ matchId: z.string().uuid(), questionIndex: z.number().int().min(0).max(999), answer: z.string().max(2000), elapsedMs: z.number().finite().nonnegative().optional() });
import { analyzeTiming } from "../_shared/answerTiming.ts";
import { reviewAnswer } from "./review.ts";
declare const EdgeRuntime: { waitUntil(task: Promise<unknown>): void };
import { requireProfile, json } from "../_shared/auth.ts";
import { submittedSpellingFeedback } from "../_shared/answerFeedback.ts";
import { voidDacRank } from "../_shared/dacRank.ts";

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
    const feedbackTask = submittedSpellingFeedback(admin, matchId, profile.id, questionIndex, result);
    if (result?.matchEnded || result?.duplicate) return json({ ...result, ...await feedbackTask });
    const isCorrect = result?.isCorrect === true;
    // Fetch feedback and timing rows together; reuse timing rows for review-only speed checks.
    const [feedback, { data: mine, error: timingError }] = await Promise.all([
      feedbackTask,
      admin.from("match_answers").select("question_index, answered_at, answer, is_correct")
        .eq("match_id", matchId).eq("player_id", profile.id),
    ]);
    if (timingError) return json({ error: "Unable to validate answer timing" }, 503);
    const timing = analyzeTiming(mine ?? []);
    EdgeRuntime.waitUntil(reviewAnswer(admin, profile, match, matchId, questionIndex, elapsedMs,
      isCorrect, mine ?? [], timing).catch(() => { console.error("Answer review unavailable"); }));

    if (timing.robotic) {
      await voidDacRank(admin, matchId, profile.id, "fixed_answer_timing");
      return json({ ok: true, isCorrect, ...feedback, dacForfeit: { reason: "fixed_answer_timing", meta: timing } });
    }

    return json({ ok: true, isCorrect, ...feedback });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
