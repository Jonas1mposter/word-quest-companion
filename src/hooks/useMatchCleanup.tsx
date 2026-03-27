import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface MatchCleanupOptions {
  profileId?: string;
  enabled?: boolean;
}

export const useMatchCleanup = ({ profileId, enabled = true }: MatchCleanupOptions) => {
  useEffect(() => {
    if (!profileId || !enabled) return;

    // Clean up stale queue entries on mount
    const cleanup = async () => {
      await supabase
        .from('match_queue')
        .delete()
        .eq('profile_id', profileId)
        .eq('status', 'searching');
    };

    cleanup();
  }, [profileId, enabled]);
};

export const isActiveMatchError = (error: any) => {
  return error?.message?.includes('active match') || false;
};

export const handleActiveMatchError = async (error: any) => {
  console.error('Active match error:', error);
};

export const cancelPlayerStaleMatches = async (profileId: string, _grade: number) => {
  // Cancel stale searching queue entries
  await supabase
    .from('match_queue')
    .delete()
    .eq('profile_id', profileId)
    .eq('status', 'searching');

  // End stale in_progress matches older than 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  
  const { data: staleMatches } = await supabase
    .from('ranked_matches')
    .select('id')
    .eq('status', 'in_progress')
    .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
    .lt('started_at', tenMinAgo);

  if (staleMatches && staleMatches.length > 0) {
    for (const match of staleMatches) {
      await supabase
        .from('ranked_matches')
        .update({ status: 'completed', ended_at: new Date().toISOString() })
        .eq('id', match.id);
    }
  }
};
