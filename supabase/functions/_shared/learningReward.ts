// Preserve the ten-word payout; scale every coin component with workload.
export function learningCoinReward(totalWords: number, correctCount: number, factor: number) {
  if (!Number.isInteger(totalWords) || totalWords < 1 || totalWords > 50 ||
      !Number.isInteger(correctCount) || correctCount < 0 || correctCount > totalWords ||
      (factor !== 1 && factor !== 2)) throw new Error("Invalid learning reward input");
  const accuracy = correctCount / totalWords;
  const bonus = accuracy === 1 ? 16 : Math.floor(accuracy * 11);
  const perfectBonus = accuracy === 1 ? totalWords : 0;
  return {
    coinsGained: (Math.floor((11 + bonus) * totalWords / 10) + perfectBonus) * factor,
    perfectBonus: perfectBonus * factor,
  };
}