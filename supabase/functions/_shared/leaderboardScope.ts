/** Personal boards share one high-school zone; other grades stay separate. */
export const leaderboardZone = (grade: number): number =>
  grade >= 9 && grade <= 12 ? 9 : grade;

export const leaderboardGrades = (grade: number): number[] =>
  leaderboardZone(grade) === 9 ? [9, 10, 11, 12] : [grade];

export const eligibleForLeaderboard = <T extends { id: string }>(
  profiles: T[], category: string, xpExcluded: ReadonlySet<string>,
): T[] => category === "leaderboard_xp"
  ? profiles.filter((p) => !xpExcluded.has(p.id))
  : profiles;