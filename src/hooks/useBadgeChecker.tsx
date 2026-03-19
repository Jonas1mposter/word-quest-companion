import { useCallback } from "react";
import { toast } from "sonner";

// Simplified badge checker for localStorage mode
// In a real implementation, this would check various conditions

interface Profile {
  id: string;
  wins?: number;
  losses?: number;
  streak?: number;
  coins?: number;
  rank_tier?: string;
}

export const checkAndAwardBadges = async (_profile: Profile | null) => {
  // No-op in localStorage mode - badges not implemented yet
};

export const useBadgeChecker = (profile: Profile | null) => {
  const checkBadges = useCallback(async () => {
    await checkAndAwardBadges(profile);
  }, [profile]);

  return { checkAndAwardBadges: checkBadges };
};
