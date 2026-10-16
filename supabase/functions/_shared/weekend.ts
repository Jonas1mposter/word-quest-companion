// 周末双倍豆：北京时间周六/周日结算的豆子收益翻倍
// 北京时间 = UTC+8，把时间前移 8 小时后按 UTC 读出星期即为北京星期
export function coinMultiplier(d: Date = new Date()): number {
  const bj = new Date(d.getTime() + 8 * 3600_000);
  const dow = bj.getUTCDay();
  return dow === 0 || dow === 6 ? 2 : 1;
}

export function isBeijingWeekend(d: Date = new Date()): boolean {
  return coinMultiplier(d) === 2;
}
