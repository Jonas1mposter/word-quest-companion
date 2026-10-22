import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { boundedRequest } from "@/lib/boundedRequest";
import { searchMatch, cancelSearch } from "@/lib/matchmaking";

interface UseMatchQueueOptions {
  profileId: string | null;
  grade: number;
  matchType: 'ranked' | 'free';
  eloRating: number;
  enabled: boolean;
  subject?: string;
  mode?: '1v1' | '2v2';
  partyId?: string | null;
  onMatchFound: (matchId: string, opponentId: string) => void;
}

const POLL_INTERVAL_MS = 3000;

export const useMatchQueue = ({
  profileId,
  grade,
  matchType,
  eloRating,
  enabled,
  subject = 'mixed',
  mode = '1v1',
  partyId = null,
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
  const requestIdRef = useRef<string | null>(null);
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
    return () => {
      generationRef.current++; cleanup();
      const id = requestIdRef.current;
      if (id) void cancelSearch(id, mode, partyId).catch(() => {});
    };
  }, [cleanup, mode, partyId]);

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
      const opponentId = (match.player1_id === profileId ? match.player2_id : match.player1_id) ?? 'bot-2';
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
    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;
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
          data = await searchMatch({ requestId, mode, matchType, subject, partyId });
          rpcError = null;
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
          if (entry.mode === mode && entry.status === 'matched' && entry.match_id) {
            await handleMatchResolved(entry.match_id);
          }
        })
        .subscribe();

      channelRef.current = channel;

      // Poll with the SAME elo (don't inflate), let the server-side function handle range
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
            .eq('mode', mode)
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

          // Server checks elapsed time and human-match races in one transaction.
          const pollData = await searchMatch({ requestId, mode, matchType, subject, partyId });
          if (generation !== generationRef.current) return;
          setError(null);

          if (pollData && !matchFoundRef.current) {
            await handleMatchResolved(pollData as string);
          }
        } catch {
          if (generation === generationRef.current) {
            setError('网络连接不稳定，请检查网络后重试');
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
  }, [profileId, grade, matchType, eloRating, enabled, subject, mode, partyId, handleMatchResolved, cleanup]);

  const leaveQueue = useCallback(async () => {
    generationRef.current++;
    cleanup();
    setIsQueued(false);
    setIsSearching(false);

    const requestId = requestIdRef.current;
    if (profileId && requestId) {
      try {
        const mid = await cancelSearch(requestId, mode, partyId);
        requestIdRef.current = null;
        if (mid) { onMatchFoundRef.current(mid, 'recovered'); return false; }
      } catch { setError('取消匹配未能确认，请检查网络'); return false; }
    }

    setIsQueued(false);
    setIsSearching(false);
    return true;
  }, [profileId, cleanup, mode, partyId]);

  return {
    isQueued,
    isSearching,
    error,
    joinQueue,
    leaveQueue,
  };
};
