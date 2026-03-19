// No-op match queue for localStorage mode
import { useState, useCallback } from "react";

interface UseMatchQueueOptions {
  profileId: string | null;
  grade: number;
  matchType: 'ranked' | 'free';
  eloRating: number;
  enabled: boolean;
  onMatchFound: (matchId: string, opponentId: string) => void;
}

export const useMatchQueue = (_options: UseMatchQueueOptions) => {
  const [isQueued] = useState(false);
  const [isSearching] = useState(false);
  const [error] = useState<string | null>(null);

  const joinQueue = useCallback(async () => {
    return null;
  }, []);

  const leaveQueue = useCallback(async () => {}, []);

  return {
    isQueued,
    isSearching,
    error,
    joinQueue,
    leaveQueue,
  };
};
