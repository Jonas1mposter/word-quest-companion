import { supabase } from "@/integrations/supabase/client";

interface LevelUpResult {
  newLevel: number;
  newXp: number;
  newXpToNextLevel: number;
  leveledUp: boolean;
  levelsGained: number;
}

export const getXpForLevel = (level: number): number => 100 * level;

export const processLevelUp = (
  currentLevel: number,
  currentXp: number,
  xpToNextLevel: number,
  xpGained: number
): LevelUpResult => {
  let newXp = currentXp + xpGained;
  let newLevel = currentLevel;
  let newXpToNextLevel = xpToNextLevel;
  let levelsGained = 0;

  while (newXp >= newXpToNextLevel) {
    newXp -= newXpToNextLevel;
    newLevel++;
    levelsGained++;
    newXpToNextLevel = getXpForLevel(newLevel);
  }

  return { newLevel, newXp, newXpToNextLevel, leveledUp: levelsGained > 0, levelsGained };
};

export const updateProfileWithXp = async (
  profileId: string,
  currentLevel: number,
  currentXp: number,
  xpToNextLevel: number,
  xpGained: number,
  additionalUpdates?: Record<string, any>
): Promise<LevelUpResult> => {
  const result = processLevelUp(currentLevel, currentXp, xpToNextLevel, xpGained);

  // Fetch current total_xp
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("total_xp")
    .eq("id", profileId)
    .single();

  const currentTotalXp = currentProfile?.total_xp || 0;

  await supabase
    .from("profiles")
    .update({
      xp: result.newXp,
      level: result.newLevel,
      xp_to_next_level: result.newXpToNextLevel,
      total_xp: currentTotalXp + xpGained,
      ...additionalUpdates,
    })
    .eq("id", profileId);

  return result;
};
