import { contentGrade } from "@/lib/zones";
import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { boundedRequest } from "@/lib/boundedRequest";

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
  const generationRef = useRef(0);
  const pollBusyRef = useRef(false);
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
    return () => { generationRef.current++; cleanup(); };
  }, [cleanup]);

  const handleMatchResolved = useCallback(async (matchId: string) => {
    if (matchFoundRef.current) return; // prevent double-fire
    const generation = generationRef.current;
    matchFoundRef.current = true;

    try {
    const { data: match } = await boundedRequest(supabase
      .from('ranked_matches')
      .select('player1_id, player2_id')
      .eq('id', matchId)
      .single());
    if (generation !== generationRef.current) return;

    if (match && profileId) {
      const opponentId = match.player1_id === profileId ? match.player2_id : match.player1_id;
      setIsSearching(false);
      setIsQueued(false);
      if (!opponentId) { matchFoundRef.current = false; setError('对局加载失败，请重试'); return; }
      cleanup();
      onMatchFoundRef.current(matchId, opponentId);
    } else {
      // match lookup failed, reset state
      matchFoundRef.current = false;
      setIsSearching(false);
      setIsQueued(false);
      setError('对局加载失败，请重试');
    }
    } catch {
      if (generation !== generationRef.current) return;
      matchFoundRef.current = false;
      cleanup(); setIsSearching(false); setIsQueued(false);
      setError('对局加载失败，请重试');
    }
  }, [profileId, cleanup]);

  const joinQueue = useCallback(async () => {
    if (!profileId || !enabled) return null;
    cleanup();
    const generation = ++generationRef.current;
    pollBusyRef.current = false;
    setError(null);
    setIsSearching(true);
    setIsQueued(true);
    matchFoundRef.current = false;

    try {
      // Retry transient network failures ("Failed to fetch") a few times
      let data: unknown = null;
      let rpcError: any = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const res = await boundedRequest(supabase.rpc('find_match', {
            _profile_id: profileId,
            _grade: contentGrade(grade),
            _match_type: matchType,
            _elo_rating: eloRating,
            _subject: subject,
          }));
          data = res.data;
          rpcError = res.error;
        } catch (e) {
          rpcError = e;
        }
        if (generation !== generationRef.current) return null;
        const msg = String(rpcError?.message || '');
        if (!rpcError || !/fetch|network|load failed/i.test(msg)) break;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        if (generation !== generationRef.current) return null;
      }

      if (rpcError) {
        if (/fetch|network|load failed/i.test(String(rpcError?.message || ''))) {
          throw new Error('网络连接不稳定，请检查网络后重试');
        }
        throw rpcError;
      }

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
          if (generation !== generationRef.current) return;
          const entry = payload.new as any;
          if (entry.mode === '1v1' && entry.status === 'matched' && entry.match_id) {
            await handleMatchResolved(entry.match_id);
          }
        })
        .subscribe();

      channelRef.current = channel;

      // Poll with the SAME elo (don't inflate), let the server-side function handle range
      const searchStartedAt = Date.now();
      pollingRef.current = setInterval(async () => {
        if (generation !== generationRef.current || pollBusyRef.current) return;
        pollBusyRef.current = true;
        try {
        if (matchFoundRef.current) return;

        try {
          // First check if we've already been matched (e.g. realtime event was missed).
          // Use limit(1) + order to tolerate any residual duplicate matched rows.
          const { data: queueEntries, error: readError } = await boundedRequest(supabase
            .from('match_queue')
            .select('status, match_id, created_at')
            .eq('profile_id', profileId)
            .eq('mode', '1v1')
            .eq('status', 'matched')
            .order('created_at', { ascending: false })
            .limit(1));
          if (generation !== generationRef.current) return;
          if (readError) throw readError;

          const queueEntry = queueEntries?.[0];
          if (queueEntry?.match_id && !matchFoundRef.current) {
            await handleMatchResolved(queueEntry.match_id);
            return;
          }

          // Check matched rows first: a match arriving at the timeout boundary
          // must be recovered, not treated as a failed search.
          if (Date.now() - searchStartedAt >= MAX_SEARCH_TIME_SECONDS * 1000) {
            cleanup(); setIsSearching(false); setIsQueued(false);
            setError('匹配超时，请重试');
            const { error: deleteError } = await boundedRequest(supabase.from('match_queue').delete()
              .eq('profile_id', profileId).eq('mode', '1v1').eq('status', 'searching'));
            if (generation === generationRef.current && deleteError) setError('取消匹配未能确认，请检查网络');
            return;
          }

          // Then try to find a new match
          const { data: pollData, error: pollError } = await boundedRequest(supabase.rpc('find_match', {
            _profile_id: profileId,
            _grade: contentGrade(grade),
            _match_type: matchType,
            _elo_rating: eloRating,
            _subject: subject,
          }));
          if (generation !== generationRef.current) return;
          if (pollError) throw pollError;
          setError(null);

          if (pollData && !matchFoundRef.current) {
            await handleMatchResolved(pollData as string);
          }
        } catch {
          if (generation === generationRef.current) {
            setError('网络连接不稳定，请检查网络后重试');
            if (Date.now() - searchStartedAt >= MAX_SEARCH_TIME_SECONDS * 1000) {
              cleanup(); setIsSearching(false); setIsQueued(false);
            }
          }
        }
        } finally { if (generation === generationRef.current) pollBusyRef.current = false; }
      }, POLL_INTERVAL_MS);

      return null;
    } catch (err: any) {
      if (generation !== generationRef.current) return null;
      console.error('Join queue error:', err);
      setError(err.message || '加入匹配失败');
      setIsSearching(false);
      setIsQueued(false);
      return null;
    }
  }, [profileId, grade, matchType, eloRating, enabled, subject, handleMatchResolved, cleanup]);

  const leaveQueue = useCallback(async () => {
    generationRef.current++;
    cleanup();
    setIsQueued(false);
    setIsSearching(false);

    if (profileId) {
      try {
      const { error: deleteError } = await boundedRequest(supabase
        .from('match_queue')
        .delete()
        .eq('profile_id', profileId)
        .eq('mode', '1v1')
        .eq('status', 'searching'));
      if (deleteError) setError('取消匹配未能确认，请检查网络');
      } catch { setError('取消匹配未能确认，请检查网络'); }
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
