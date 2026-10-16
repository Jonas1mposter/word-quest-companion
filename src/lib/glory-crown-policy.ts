export interface GloryCrownState {
  discount_price: number;
  discount_limit: number;
  standard_price: number;
  discounted_purchases: number;
  main_pct: number;
  sub_pct: number;
  mythology_pct: number;
  legendary_pct: number;
  coins_200_pct: number;
  coins_100_pct: number;
  pity_main_limit: number;
  pity_sub_limit: number;
  pity_mythology_limit: number;
  pity_legendary_limit: number;
  pity_main: number;
  pity_sub: number;
  pity_mythology: number;
  pity_legendary: number;
}

/** Draws left (including the guaranteed one) until each pity triggers. */
export function gloryPityRemaining(s: GloryCrownState) {
  return {
    main: Math.max(1, s.pity_main_limit - s.pity_main),
    sub: Math.max(1, s.pity_sub_limit - s.pity_sub),
    mythology: Math.max(1, s.pity_mythology_limit - s.pity_mythology),
    legendary: Math.max(1, s.pity_legendary_limit - s.pity_legendary),
  };
}

export function gloryTiers(s: GloryCrownState) {
  return [
    { label: "100 狄邦豆", pct: s.coins_100_pct },
    { label: "200 狄邦豆", pct: s.coins_200_pct },
    { label: "传说限定名片", pct: s.legendary_pct },
    { label: "神话限定名片", pct: s.mythology_pct },
    { label: "副套音效（2025 全球冠军赛 / 千灵华绽 / 天界神兵）", pct: s.sub_pct },
    { label: "主套音效（2021 全球冠军赛 / 侦查力量）", pct: s.main_pct },
  ];
}
