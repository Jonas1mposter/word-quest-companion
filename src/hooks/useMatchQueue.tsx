import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseMatchQueueOptions {
  profileId: string | null;
  grade: number;
  matchType: 'ranked' | 'free';
  eloRating: number;
  enabled: boolean;
  subject?: string;
  onMatchFound: (matchId: string, opponentId: string) => void;
}

export const useMatchQueue = ({
  profileId,
  grade,
  matchType,
  eloRating,
  enabled,
  subject = 'mixed',
  onMatchFound,
}: UseMatchQueueOptions) => {
  const [isQueued, setIsQueued] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const joinQueue = useCallback(async () => {
    if (!profileId || !enabled) return null;
    setError(null);
    setIsSearching(true);
    setIsQueued(true);

    try {
      // Call the find_match function
      const { data, error: rpcError } = await supabase.rpc('find_match', {
        _profile_id: profileId,
        _grade: grade,
        _match_type: matchType,
        _elo_rating: eloRating,
        _subject: subject,
      });

      if (rpcError) throw rpcError;

      if (data) {
        // Match found immediately!
        const matchId = data as string;
        // Get opponent info
        const { data: match } = await supabase
          .from('ranked_matches')
          .select('player1_id, player2_id')
          .eq('id', matchId)
          .single();
        
        if (match) {
          const opponentId = match.player1_id === profileId ? match.player2_id : match.player1_id;
          setIsSearching(false);
          setIsQueued(false);
          onMatchFound(matchId, opponentId!);
        }
        return matchId;
      }

      // No immediate match - we're in the queue. Subscribe for updates.
      // Listen for our queue entry being matched
      const channel = supabase
        .channel(`match-queue-${profileId}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_queue',
          filter: `profile_id=eq.${profileId}`,
        }, async (payload) => {
          const entry = payload.new as any;
          if (entry.status === 'matched' && entry.match_id) {
            const { data: match } = await supabase
              .from('ranked_matches')
              .select('player1_id, player2_id')
              .eq('id', entry.match_id)
              .single();
            
            if (match) {
              const opponentId = match.player1_id === profileId ? match.player2_id : match.player1_id;
              setIsSearching(false);
              setIsQueued(false);
              if (channelRef.current) supabase.removeChannel(channelRef.current);
              if (pollingRef.current) clearInterval(pollingRef.current);
              onMatchFound(entry.match_id, opponentId!);
            }
          }
        })
        .subscribe();

      channelRef.current = channel;

      // Also poll find_match every 3 seconds to expand search
      let pollCount = 0;
      pollingRef.current = setInterval(async () => {
        pollCount++;
        try {
          const { data: pollData } = await supabase.rpc('find_match', {
            _profile_id: profileId,
            _grade: grade,
            _match_type: matchType,
            _elo_rating: Math.min(3000, eloRating + pollCount * 50), // Widen range over time
            _subject: subject,
          });

          if (pollData) {
            const matchId = pollData as string;
            const { data: match } = await supabase
              .from('ranked_matches')
              .select('player1_id, player2_id')
              .eq('id', matchId)
              .single();
            
            if (match) {
              const opponentId = match.player1_id === profileId ? match.player2_id : match.player1_id;
              setIsSearching(false);
              setIsQueued(false);
              if (pollingRef.current) clearInterval(pollingRef.current);
              if (channelRef.current) supabase.removeChannel(channelRef.current);
              onMatchFound(matchId, opponentId!);
            }
          }
        } catch (e) {
          // Ignore polling errors
        }
      }, 3000);

      return null;
    } catch (err: any) {
      console.error('Join queue error:', err);
      setError(err.message || '加入匹配失败');
      setIsSearching(false);
      setIsQueued(false);
      return null;
    }
  }, [profileId, grade, matchType, eloRating, enabled, subject, onMatchFound]);

  const leaveQueue = useCallback(async () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (profileId) {
      await supabase
        .from('match_queue')
        .delete()
        .eq('profile_id', profileId)
        .eq('status', 'searching');
    }

    setIsQueued(false);
    setIsSearching(false);
  }, [profileId]);

  return {
    isQueued,
    isSearching,
    error,
    joinQueue,
    leaveQueue,
  };
};
