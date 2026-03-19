interface LevelUpResult {
  newLevel: number; newXp: number; newXpToNextLevel: number; leveledUp: boolean; levelsGained: number;
}
export const getXpForLevel = (level: number): number => 100 * level;
export const processLevelUp = (currentLevel: number, currentXp: number, xpToNextLevel: number, xpGained: number): LevelUpResult => {
  let newXp = currentXp + xpGained, newLevel = currentLevel, newXpToNextLevel = xpToNextLevel, levelsGained = 0;
  while (newXp >= newXpToNextLevel) { newXp -= newXpToNextLevel; newLevel++; levelsGained++; newXpToNextLevel = getXpForLevel(newLevel); }
  return { newLevel, newXp, newXpToNextLevel, leveledUp: levelsGained > 0, levelsGained };
};
export const updateProfileWithXp = async (profileId: string, currentLevel: number, currentXp: number, xpToNextLevel: number, xpGained: number, additionalUpdates?: Record<string, any>): Promise<LevelUpResult> => {
  const result = processLevelUp(currentLevel, currentXp, xpToNextLevel, xpGained);
  const profiles = JSON.parse(localStorage.getItem('wq_profiles') || '[]');
  const idx = profiles.findIndex((p: any) => p.id === profileId);
  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], xp: result.newXp, level: result.newLevel, xp_to_next_level: result.newXpToNextLevel, total_xp: (profiles[idx].total_xp || 0) + xpGained, ...additionalUpdates };
    localStorage.setItem('wq_profiles', JSON.stringify(profiles));
  }
  return result;
};
