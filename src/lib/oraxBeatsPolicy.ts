export interface OraxBeatsState {
  discount_price: number;
  discount_limit: number;
  standard_price: number;
  discounted_purchases: number;
  main_pct: number;
  sub_pct: number;
  coins_200_pct: number;
  coins_100_pct: number;
  pity_main_limit: number;
  pity_sub_limit: number;
  pity_main: number;
  pity_sub: number;
}

/** Draws left (including the guaranteed one) until each pity triggers. */
export function oraxPityRemaining(s: OraxBeatsState) {
  return {
    main: Math.max(1, s.pity_main_limit - s.pity_main),
    sub: Math.max(1, s.pity_sub_limit - s.pity_sub),
  };
}

export function oraxTiers(s: OraxBeatsState) {
  return [
    { label: "100 狄邦豆", pct: s.coins_100_pct },
    { label: "200 狄邦豆", pct: s.coins_200_pct },
    { label: "副套音效（洪荒怒焰 / 逆命中队 / 奇点 / 西部未来）", pct: s.sub_pct },
    { label: "主套音效（ORA X 颗秒 · 5 套可切换）", pct: s.main_pct },
  ];
}
