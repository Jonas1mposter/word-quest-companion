import { useState, useCallback, useEffect, useRef } from "react";
import { remainingBattleSeconds } from "@/lib/battleClock";
import { supabase } from "@/integrations/supabase/client";
import { boundedRequest } from "@/lib/boundedRequest";

interface ActiveMatch {
  id: string;
  type: "ranked" | "free";
  mode: "1v1" | "2v2";
  subject: string;
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
  const generationRef = useRef(0);

  const checkForActiveMatch = useCallback(async () => {
    if (!profileId || !enabled) return null;
    const generation = ++generationRef.current;
    setIsChecking(true);

    try {
      // Check for in_progress matches
      const { data: matches, error: matchError } = await boundedRequest(supabase
        .from('ranked_matches')
        .select('*')
        .eq('status', 'in_progress')
        .or(`player1_id.eq.${profileId},player2_id.eq.${profileId},player3_id.eq.${profileId},player4_id.eq.${profileId}`)
        .order('created_at', { ascending: false })
        .limit(1));
      if (matchError) throw matchError;

      if (matches && matches.length > 0) {
        const match = matches[0];
        const isPlayer1 = match.player1_id === profileId || match.player3_id === profileId;
        const opponentId = isPlayer1 ? match.player2_id : match.player1_id;

        // Get opponent profile
        const { data: opponent } = await boundedRequest(supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', opponentId ?? '')
          .single());

        // Count answered questions
        const { count } = await boundedRequest(supabase
          .from('match_answers')
          .select('*', { count: 'exact', head: true })
          .eq('match_id', match.id)
          .eq('player_id', profileId));

        const timeRemaining = remainingBattleSeconds(match.started_at);
        if (generation !== generationRef.current) return null;

        {
          setActiveMatch({
            id: match.id,
            type: match.match_type as "ranked" | "free",
            mode: match.mode === '2v2' ? '2v2' : '1v1',
            subject: match.subject ?? 'mixed',
            opponentName: opponent?.username || '对手',
            opponentAvatar: opponent?.avatar_url || undefined,
            myScore: match.mode === '2v2' ? (isPlayer1 ? match.team1_score : match.team2_score) : (isPlayer1 ? match.player1_score : match.player2_score),
            opponentScore: match.mode === '2v2' ? (isPlayer1 ? match.team2_score : match.team1_score) : (isPlayer1 ? match.player2_score : match.player1_score),
            currentQuestion: count || 0,
            timeRemaining,
            createdAt: match.created_at,
          });
          return match;
        }
      }

      if (generation === generationRef.current) setActiveMatch(null);
      return null;
    } catch (err) {
      console.error('Check active match error:', err);
      return null;
    } finally {
      if (generation === generationRef.current) setIsChecking(false);
    }
  }, [profileId, enabled]);

  // Auto-check on mount
  useEffect(() => {
    if (profileId && enabled) void checkForActiveMatch();
    return () => { generationRef.current++; };
  }, [profileId, enabled, checkForActiveMatch]);

  const dismissMatch = useCallback(async () => {
    if (activeMatch && profileId) {
      const { data, error } = await boundedRequest(supabase.functions.invoke('process-match', {
        body: { matchId: activeMatch.id, forfeit: { reason: 'surrender', meta: {} } },
      }));
      if (error || !data?.ok) throw new Error('退赛未能确认，请重试');
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
