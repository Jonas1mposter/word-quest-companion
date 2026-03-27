import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ActiveMatch {
  id: string;
  type: "ranked" | "free";
  opponentName: string;
  opponentAvatar?: string;
  myScore: number;
  opponentScore: number;
  currentQuestion: number;
  timeRemaining: number;
  createdAt: string;
}

interface UseMatchReconnectProps {
  profileId: string | undefined;
  enabled?: boolean;
}

export const useMatchReconnect = ({ profileId, enabled = true }: UseMatchReconnectProps) => {
  const [activeMatch, setActiveMatch] = useState<ActiveMatch | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkForActiveMatch = useCallback(async () => {
    if (!profileId || !enabled) return null;
    setIsChecking(true);

    try {
      // Check for in_progress matches
      const { data: matches } = await supabase
        .from('ranked_matches')
        .select('*')
        .eq('status', 'in_progress')
        .or(`player1_id.eq.${profileId},player2_id.eq.${profileId}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (matches && matches.length > 0) {
        const match = matches[0];
        const isPlayer1 = match.player1_id === profileId;
        const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

        // Get opponent profile
        const { data: opponent } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', opponentId!)
          .single();

        // Count answered questions
        const { count } = await supabase
          .from('match_answers')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', match.id)
          .eq('player_id', profileId);

        const startedAt = match.started_at ? new Date(match.started_at).getTime() : Date.now();
        const elapsed = (Date.now() - startedAt) / 1000;
        const timeRemaining = Math.max(0, 300 - elapsed); // 5 min matches

        if (timeRemaining > 0) {
          setActiveMatch({
            id: match.id,
            type: match.match_type as "ranked" | "free",
            opponentName: opponent?.username || '对手',
            opponentAvatar: opponent?.avatar_url || undefined,
            myScore: isPlayer1 ? match.player1_score : match.player2_score,
            opponentScore: isPlayer1 ? match.player2_score : match.player1_score,
            currentQuestion: count || 0,
            timeRemaining,
            createdAt: match.created_at,
          });
          return match;
        }
      }

      return null;
    } catch (err) {
      console.error('Check active match error:', err);
      return null;
    } finally {
      setIsChecking(false);
    }
  }, [profileId, enabled]);

  // Auto-check on mount
  useState(() => {
    if (profileId && enabled) {
      checkForActiveMatch();
    }
  });

  const dismissMatch = useCallback(async () => {
    if (activeMatch && profileId) {
      // Forfeit the match
      await supabase
        .from('ranked_matches')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          winner_id: activeMatch.opponentName ? undefined : null,
        })
        .eq('id', activeMatch.id);
    }
    setActiveMatch(null);
  }, [activeMatch, profileId]);

  const clearActiveMatch = useCallback(() => {
    setActiveMatch(null);
  }, []);

  return {
    activeMatch,
    isChecking,
    checkForActiveMatch,
    dismissMatch,
    clearActiveMatch,
  };
};
