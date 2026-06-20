import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  [key: string]: any;
}

/** 调用服务端 award_badges_for_profile，按当前数据自动发放徽章。 */
export const checkAndAwardBadges = async (profile: Profile | null) => {
  if (!profile?.id) return 0;
  const { data, error } = await supabase.rpc("award_badges_for_profile", {
    p_id: profile.id,
  });
  if (error) {
    console.warn("award_badges_for_profile failed", error);
    return 0;
  }
  return Number(data ?? 0);
};

export const useBadgeChecker = (profile: Profile | null) => {
  const checkBadges = useCallback(async () => {
    return await checkAndAwardBadges(profile);
  }, [profile]);

  return { checkAndAwardBadges: checkBadges };
};
