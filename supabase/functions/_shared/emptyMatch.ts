type EmptyMatchClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: { handled?: boolean } | null;
    error: { message: string } | null;
  }>;
};

// The RPC locks the match together with grading, so a racing answer cannot
// turn an empty settlement into a paid match, and forfeits are penalized once.
export async function settleEmptyMatch(
  admin: EmptyMatchClient,
  matchId: string,
  mode: string,
  forfeiterId: string | null,
) {
  const { data, error } = await admin.rpc("complete_empty_match", {
    p_match_id: matchId, p_forfeiter_id: forfeiterId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Empty match validation failed");
  if (!data.handled) return null;
  return {
    ok: true, mode, noAnswers: true,
    winnerId: null, winnerTeam: null,
    player1_score: 0, player2_score: 0, team1_score: 0, team2_score: 0,
    coinsEarned: 0, xpEarned: 0, weekendBonus: false,
  };
}