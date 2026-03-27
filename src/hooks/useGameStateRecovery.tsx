import { useEffect, useRef } from "react";

interface GameState {
  matchId?: string;
  currentQuestion?: number;
  myScore?: number;
  opponentScore?: number;
}

interface RecoveryOptions {
  onRecover?: (state: GameState) => void;
}

export const useGameStateRecovery = (state: GameState, options: RecoveryOptions) => {
  const stateRef = useRef(state);
  stateRef.current = state;

  // Save state to localStorage periodically
  useEffect(() => {
    if (!state.matchId) return;

    const key = `game_state_${state.matchId}`;
    localStorage.setItem(key, JSON.stringify(state));

    return () => {
      // Clean up saved state when component unmounts normally
      localStorage.removeItem(key);
    };
  }, [state]);

  const manualReset = () => {
    if (state.matchId) {
      localStorage.removeItem(`game_state_${state.matchId}`);
    }
  };

  // Check for recoverable state on mount
  useEffect(() => {
    if (state.matchId && options.onRecover) {
      const key = `game_state_${state.matchId}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.currentQuestion > 0) {
            options.onRecover(parsed);
          }
        } catch { /* ignore */ }
      }
    }
  }, [state.matchId]);

  return { manualReset };
};
