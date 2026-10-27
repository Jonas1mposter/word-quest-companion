// Only read the secret after both the accepted grade and this player's persisted submission.
export async function submittedSpellingFeedback(
  admin: any, matchId: string, profileId: string, questionIndex: number, result: { ok?: boolean },
): Promise<{ correctAnswer?: string }> {
  if (result?.ok !== true) return {};
  const [{ data: submitted, error: answerError }, { data: issue, error: issueError }] = await Promise.all([
    admin.from("match_answers")
    .select("question_index").eq("match_id", matchId).eq("player_id", profileId)
    .eq("question_index", questionIndex).maybeSingle(),
    admin.from("match_question_issues")
    .select("question_type").eq("match_id", matchId).eq("profile_id", profileId)
    .eq("question_index", questionIndex).maybeSingle(),
  ]);
  if (answerError || !submitted || issueError || !["spelling", "listening"].includes(issue?.question_type)) return {};
  const { data: secret, error: secretError } = await admin.from("match_question_secrets")
    .select("words").eq("match_id", matchId).maybeSingle();
  const correctAnswer = secret?.words?.[questionIndex]?.word;
  return !secretError && typeof correctAnswer === "string" ? { correctAnswer } : {};
}