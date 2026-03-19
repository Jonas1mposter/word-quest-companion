import { useState, useCallback } from "react";

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
  const [isChecking] = useState(false);

  const checkForActiveMatch = useCallback(async () => {
    // No reconnect in localStorage mode
    return null;
  }, [profileId, enabled]);

  const dismissMatch = useCallback(async () => {
    setActiveMatch(null);
  }, []);

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
