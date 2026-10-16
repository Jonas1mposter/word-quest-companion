export interface LotteryState {
  discount_price: number;
  discount_limit: number;
  standard_price: number;
  discounted_purchases: number;
  promotion_draws: number;
  promotion_active: boolean;
  promotion_end: string;
  sound_pct: number;
  pity_limit: number;
  owns_sound: boolean;
}

export function discountRemaining(state: LotteryState) {
  return Math.max(0, state.discount_limit - state.discounted_purchases);
}

export function pityRemaining(state: LotteryState) {
  if (!state.promotion_active || state.owns_sound) return null;
  return Math.max(1, state.pity_limit - state.promotion_draws);
}

export function lotteryTiers(soundPct: number) {
  return [
    { label: "100 狄邦豆", pct: 51 - soundPct },
    { label: "200 狄邦豆", pct: 30 },
    { label: "史诗/传说限定名片", pct: 15 },
    { label: "神话限定名片", pct: 4 },
    { label: "2024 全球冠军赛音效", pct: soundPct },
  ];
}