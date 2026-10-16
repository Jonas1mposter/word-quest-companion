import { describe, expect, it } from "vitest";
import { discountRemaining, pityRemaining, lotteryTiers, type LotteryState } from "@/lib/lottery-policy";

const state: LotteryState = {
  discount_price: 150, discount_limit: 10, standard_price: 200,
  discounted_purchases: 0, promotion_draws: 0, promotion_active: true,
  promotion_end: "2026-10-31T16:00:00Z", sound_pct: 4, pity_limit: 25, owns_sound: false,
};

describe("抽奖优惠与保底", () => {
  it("每奖池十次优惠，用完为零；另一奖池重新计算", () => {
    expect(discountRemaining({ ...state, discounted_purchases: 9 })).toBe(1);
    expect(discountRemaining({ ...state, discounted_purchases: 10 })).toBe(0);
    expect(discountRemaining(state)).toBe(10);
  });
  it("25抽保底：第24抽后只差一抽", () => {
    expect(pityRemaining(state)).toBe(25);
    expect(pityRemaining({ ...state, promotion_draws: 24 })).toBe(1);
  });
  it("已拥有音效不再需要保底", () => {
    expect(pityRemaining({ ...state, owns_sound: true })).toBeNull();
  });
  it("限时结束不再显示保底", () => {
    expect(pityRemaining({ ...state, promotion_active: false })).toBeNull();
  });
  it("活动基础音效4%，总概率100%", () => {
    const tiers = lotteryTiers(4);
    expect(tiers[4].pct).toBe(4);
    expect(tiers[0].pct).toBe(47);
    expect(tiers.reduce((sum, t) => sum + t.pct, 0)).toBe(100);
  });
  it("活动结束恢复音效1%及原概率", () => {
    expect(lotteryTiers(1).map(t => t.pct)).toEqual([50, 30, 15, 4, 1]);
  });
});