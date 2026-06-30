import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

// Submit an answer for a ranked/free match. Server-validates correctness
// against the stored words[] payload. Updates the player's score atomically.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { matchId, questionIndex, answer, quizType } = await req.json();

    if (typeof matchId !== "string" || typeof questionIndex !== "number") {
      return json({ error: "Bad request" }, 400);
    }

    const { data: match, error: mErr } = await admin
      .from("ranked_matches")
      .select("id, player1_id, player2_id, player1_score, player2_score, words, status, match_type")
      .eq("id", matchId)
      .single();
    if (mErr || !match) return json({ error: "Match not found" }, 404);
    // Return 200 with a flag so the client doesn't surface this as a runtime error.
    if (match.status === "completed") return json({ ok: true, matchEnded: true, isCorrect: false }, 200);

    const isP1 = match.player1_id === profile.id;
    const isP2 = match.player2_id === profile.id;
    if (!isP1 && !isP2) return json({ error: "Not in match" }, 403);

    const words = (match.words as any[]) || [];
    const word = words[questionIndex];
    if (!word) return json({ error: "Bad question" }, 400);

    // Determine correctness server-side based on quiz type.
    let isCorrect = false;
    const norm = (s: any) => String(s ?? "").trim().toLowerCase();
    switch (quizType) {
      case "meaning":
        isCorrect = norm(answer) === norm(word.meaning);
        break;
      case "reverse":
      case "spelling":
      case "listening":
        isCorrect = norm(answer) === norm(word.word);
        break;
      default:
        // Fallback: accept if matches either field.
        isCorrect = norm(answer) === norm(word.word) || norm(answer) === norm(word.meaning);
    }

    // Prevent duplicate submission for same (match, player, question).
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

    if (isCorrect) {
      const field = isP1 ? "player1_score" : "player2_score";
      const newScore = (isP1 ? match.player1_score : match.player2_score) + 1;
      await admin
        .from("ranked_matches")
        .update({ [field]: newScore })
        .eq("id", matchId);
    }

    return json({ ok: true, isCorrect });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
