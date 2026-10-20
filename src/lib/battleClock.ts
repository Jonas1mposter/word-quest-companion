export function remainingBattleSeconds(startedAt: string | null | undefined, now = Date.now()) {
  const started = startedAt ? Date.parse(startedAt) : NaN;
  if (!Number.isFinite(started)) return 300;
  return Math.max(0, Math.min(300, Math.ceil((started + 300000 - now) / 1000)));
}