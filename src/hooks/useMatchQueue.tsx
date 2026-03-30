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

const MAX_SEARCH_TIME_SECONDS = 60;
const POLL_INTERVAL_MS = 3000;

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
  const matchFoundRef = useRef(false);
  const onMatchFoundRef = useRef(onMatchFound);
  onMatchFoundRef.current = onMatchFound;

  const cleanup = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const handleMatchResolved = useCallback(async (matchId: string) => {
    if (matchFoundRef.current) return; // prevent double-fire
    matchFoundRef.current = true;
    cleanup();

    const { data: match } = await supabase
      .from('ranked_matches')
      .select('player1_id, player2_id')
      .eq('id', matchId)
      .single();

    if (match && profileId) {
      const opponentId = match.player1_id === profileId ? match.player2_id : match.player1_id;
      setIsSearching(false);
      setIsQueued(false);
      onMatchFoundRef.current(matchId, opponentId!);
    } else {
      // match lookup failed, reset state
      matchFoundRef.current = false;
      setIsSearching(false);
      setIsQueued(false);
    }
  }, [profileId, cleanup]);

  const joinQueue = useCallback(async () => {
    if (!profileId || !enabled) return null;
    setError(null);
    setIsSearching(true);
    setIsQueued(true);
    matchFoundRef.current = false;

    try {
      const { data, error: rpcError } = await supabase.rpc('find_match', {
        _profile_id: profileId,
        _grade: grade,
        _match_type: matchType,
        _elo_rating: eloRating,
        _subject: subject,
      });

      if (rpcError) throw rpcError;

      if (data) {
        await handleMatchResolved(data as string);
        return data as string;
      }

      // No immediate match — subscribe for real-time updates
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
            await handleMatchResolved(entry.match_id);
          }
        })
        .subscribe();

      channelRef.current = channel;

      // Poll with the SAME elo (don't inflate), let the server-side function handle range
      let pollCount = 0;
      pollingRef.current = setInterval(async () => {
        pollCount++;
        if (matchFoundRef.current) return;

        // Auto-cancel after timeout
        if (pollCount * (POLL_INTERVAL_MS / 1000) >= MAX_SEARCH_TIME_SECONDS) {
          cleanup();
          setIsSearching(false);
          setIsQueued(false);
          setError('匹配超时，请重试');
          // Clean up queue entry
          await supabase
            .from('match_queue')
            .delete()
            .eq('profile_id', profileId)
            .eq('status', 'searching');
          return;
        }

        try {
          // First check if we've already been matched (e.g. realtime event was missed)
          const { data: queueEntry } = await supabase
            .from('match_queue')
            .select('status, match_id')
            .eq('profile_id', profileId)
            .eq('status', 'matched')
            .maybeSingle();

          if (queueEntry?.match_id && !matchFoundRef.current) {
            await handleMatchResolved(queueEntry.match_id);
            return;
          }

          // Then try to find a new match
          const { data: pollData } = await supabase.rpc('find_match', {
            _profile_id: profileId,
            _grade: grade,
            _match_type: matchType,
            _elo_rating: eloRating,
            _subject: subject,
          });

          if (pollData && !matchFoundRef.current) {
            await handleMatchResolved(pollData as string);
          }
        } catch {
          // Ignore polling errors
        }
      }, POLL_INTERVAL_MS);

      return null;
    } catch (err: any) {
      console.error('Join queue error:', err);
      setError(err.message || '加入匹配失败');
      setIsSearching(false);
      setIsQueued(false);
      return null;
    }
  }, [profileId, grade, matchType, eloRating, enabled, subject, handleMatchResolved, cleanup]);

  const leaveQueue = useCallback(async () => {
    cleanup();

    if (profileId) {
      await supabase
        .from('match_queue')
        .delete()
        .eq('profile_id', profileId)
        .eq('status', 'searching');
    }

    setIsQueued(false);
    setIsSearching(false);
  }, [profileId, cleanup]);

  return {
    isQueued,
    isSearching,
    error,
    joinQueue,
    leaveQueue,
  };
};
