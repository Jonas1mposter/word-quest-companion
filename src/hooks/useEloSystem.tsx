import { useCallback } from 'react';

const K_FACTOR = 32;

export const calculateExpectedScore = (playerElo: number, opponentElo: number): number => {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
};

export const calculateEloChange = (
  playerElo: number,
  opponentElo: number,
  playerWon: boolean,
  isDraw: boolean = false,
  _isNewPlayer: boolean = false
) => {
  const expectedScore = calculateExpectedScore(playerElo, opponentElo);
  const actualScore = isDraw ? 0.5 : (playerWon ? 1 : 0);
  const playerEloChange = Math.round(K_FACTOR * (actualScore - expectedScore));
  
  return {
    newPlayerElo: Math.max(100, playerElo + playerEloChange),
    newOpponentElo: Math.max(100, opponentElo - playerEloChange),
    playerEloChange,
    opponentEloChange: -playerEloChange,
  };
};

export const calculateEloRange = (searchTimeSeconds: number): number => {
  const baseRange = 50;
  const expansion = Math.floor(searchTimeSeconds / 5) * 25;
  return Math.min(200, baseRange + expansion);
};

export const getStreakBonus = (winStreak: number): number => {
  if (winStreak >= 4) return 1.3;
  if (winStreak >= 3) return 1.2;
  if (winStreak >= 2) return 1.1;
  return 1.0;
};

export const useEloSystem = () => {
  const updateEloAfterMatch = useCallback(async (
    profileId: string,
    playerElo: number,
    opponentElo: number,
    playerWon: boolean,
    isDraw: boolean = false,
    isNewPlayer: boolean = false,
    isFreeMatch: boolean = false
  ) => {
    const result = calculateEloChange(playerElo, opponentElo, playerWon, isDraw, isNewPlayer);
    
    // Update in localStorage
    const profiles = JSON.parse(localStorage.getItem('wq_profiles') || '[]');
    const idx = profiles.findIndex((p: any) => p.id === profileId);
    if (idx >= 0) {
      const field = isFreeMatch ? 'elo_free' : 'elo_rating';
      profiles[idx][field] = result.newPlayerElo;
      localStorage.setItem('wq_profiles', JSON.stringify(profiles));
    }
    
    return result;
  }, []);

  const findMatchesWithinEloRange = useCallback(async () => {
    return [];
  }, []);

  const getWinStreak = useCallback(async () => {
    return 0;
  }, []);

  return {
    calculateExpectedScore,
    calculateEloChange,
    calculateEloRange,
    getStreakBonus,
    updateEloAfterMatch,
    findMatchesWithinEloRange,
    getWinStreak,
  };
};

export default useEloSystem;
