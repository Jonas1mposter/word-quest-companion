// No-op game state recovery for localStorage mode
export const useGameStateRecovery = (_state: any, _options: any) => {
  return { manualReset: () => {} };
};
