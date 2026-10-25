// 增益卡：排位不掉分卡与双倍经验/豆数/排位分卡。
// 购买与消耗都走服务器（purchase_booster RPC / 结算时扣次），客户端只读自己的卡。

export type BoostType = "rank_shield" | "double_xp" | "double_coins" | "double_elo";

export interface BoostRow {
  id: string;
  profile_id: string;
  boost_type: string;
  uses_remaining: number | null;
  expires_at: string | null;
}

export interface BoostSet {
  xp: 1 | 2;
  coins: 1 | 2;
  elo: 1 | 2;
  shield: { id: string; uses_remaining: number } | null;
}

export const isBoostActive = (b: BoostRow, now: Date = new Date()): boolean =>
  (b.expires_at === null || new Date(b.expires_at) > now) &&
  (b.uses_remaining === null || b.uses_remaining > 0);

// 汇总一名玩家当前生效的增益：双倍卡看有效期，不掉分卡看剩余次数。
export function boostSet(rows: BoostRow[], profileId: string, now: Date = new Date()): BoostSet {
  const mine = rows.filter((r) => r.profile_id === profileId && isBoostActive(r, now));
  const has = (t: BoostType) => mine.some((r) => r.boost_type === t);
  const shieldRow = mine.find((r) => r.boost_type === "rank_shield");
  return {
    xp: has("double_xp") ? 2 : 1,
    coins: has("double_coins") ? 2 : 1,
    elo: has("double_elo") ? 2 : 1,
    shield: shieldRow ? { id: shieldRow.id, uses_remaining: shieldRow.uses_remaining ?? 0 } : null,
  };
}

// 排位 ELO 变化应用增益：胜利且装备双倍排位分卡则翻倍；
// 失败且有不掉分卡则不扣分并消耗一次（返回 shielded）。
export function applyEloBoost(
  delta: number,
  score: 1 | 0 | 0.5,
  bs: BoostSet,
): { delta: number; shielded: boolean } {
  if (score === 1 && bs.elo === 2) return { delta: delta * 2, shielded: false };
  if (score === 0 && bs.shield) return { delta: 0, shielded: true };
  return { delta, shielded: false };
}
