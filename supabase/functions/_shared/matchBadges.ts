// Compare server-graded final scores; no shutout or perfect-score prerequisite.
export const earnsDimensionalStrike = (winnerScore: number, loserScore: number) => winnerScore - loserScore >= 8;
export const earnsTwinStars = (winnerScore: number, loserScore: number) => winnerScore - loserScore >= 15;