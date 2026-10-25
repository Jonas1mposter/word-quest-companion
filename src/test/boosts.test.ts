import { describe, it, expect } from "vitest";
import { boostSet, isBoostActive, applyEloBoost, type BoostRow } from "../../supabase/functions/_shared/boosts";

const NOW = new Date("2026-10-26T00:00:00Z");
const row = (over: Partial<BoostRow>): BoostRow => ({
  id: "b1", profile_id: "p1", boost_type: "double_xp",
  uses_remaining: null, expires_at: null, ...over,
});

describe("增益卡生效判断", () => {
  it("双倍卡未过期生效，过期失效", () => {
    expect(isBoostActive(row({ expires_at: "2026-10-27T00:00:00Z" }), NOW)).toBe(true);
    expect(isBoostActive(row({ expires_at: "2026-10-25T00:00:00Z" }), NOW)).toBe(false);
  });

  it("不掉分卡按次数生效，用完失效", () => {
    expect(isBoostActive(row({ boost_type: "rank_shield", uses_remaining: 3 }), NOW)).toBe(true);
    expect(isBoostActive(row({ boost_type: "rank_shield", uses_remaining: 0 }), NOW)).toBe(false);
  });

  it("只汇总本人的卡", () => {
    const bs = boostSet([row({ profile_id: "other" })], "p1", NOW);
    expect(bs).toEqual({ xp: 1, coins: 1, elo: 1, shield: null });
  });

  it("四类卡各自独立生效", () => {
    const bs = boostSet([
      row({ id: "a", boost_type: "double_xp", expires_at: "2026-10-27T00:00:00Z" }),
      row({ id: "b", boost_type: "double_coins", expires_at: "2026-10-27T00:00:00Z" }),
      row({ id: "c", boost_type: "double_elo", expires_at: "2026-10-27T00:00:00Z" }),
      row({ id: "d", boost_type: "rank_shield", uses_remaining: 2 }),
    ], "p1", NOW);
    expect(bs).toEqual({ xp: 2, coins: 2, elo: 2, shield: { id: "d", uses_remaining: 2 } });
  });
});

describe("排位分增益", () => {
  const base = { xp: 1 as const, coins: 1 as const, elo: 1 as const, shield: null };

  it("胜利且装备双倍排位分卡：得分翻倍", () => {
    expect(applyEloBoost(16, 1, { ...base, elo: 2 })).toEqual({ delta: 32, shielded: false });
  });

  it("失败且有不掉分卡：不扣分并消耗", () => {
    const bs = { ...base, shield: { id: "s1", uses_remaining: 3 } };
    expect(applyEloBoost(-16, 0, bs)).toEqual({ delta: 0, shielded: true });
  });

  it("失败且无不掉分卡：正常扣分", () => {
    expect(applyEloBoost(-16, 0, base)).toEqual({ delta: -16, shielded: false });
  });

  it("平局不受任何排位增益影响", () => {
    expect(applyEloBoost(3, 0.5, { ...base, elo: 2, shield: { id: "s", uses_remaining: 1 } }))
      .toEqual({ delta: 3, shielded: false });
  });

  it("双倍排位分卡不影响失败扣分", () => {
    expect(applyEloBoost(-16, 0, { ...base, elo: 2 })).toEqual({ delta: -16, shielded: false });
  });
});
