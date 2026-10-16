import { describe, expect, it } from "vitest";

async function rpc(name: string, body: Record<string, unknown>) {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase test configuration");
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Lottery rule request failed: ${response.status}`);
  return response.json();
}

const during = "2026-10-20T00:00:00Z";
describe("线上抽奖结算规则（只读，不扣豆不发奖）", () => {
  it("150豆每奖池仅十次，第十次允许，第十一次拒绝", async () => {
    expect(await rpc("lottery_ticket_quote", { p_discounted: true, p_used: 9, p_coins: 150 })).toEqual({ price: 150 });
    expect(await rpc("lottery_ticket_quote", { p_discounted: true, p_used: 10, p_coins: 10000 })).toEqual({ error: "discount_limit" });
  });
  it("200豆不限购", async () => {
    expect(await rpc("lottery_ticket_quote", { p_discounted: false, p_used: 100000, p_coins: 200 })).toEqual({ price: 200 });
  });
  it("余额不足不能兑换", async () => {
    expect(await rpc("lottery_ticket_quote", { p_discounted: true, p_used: 0, p_coins: 149 })).toEqual({ error: "insufficient_coins" });
  });
  it("4%音效概率的边界", async () => {
    expect(await rpc("champions_lottery_tier", { p_roll: 3.999, p_draws: 0, p_owned: false, p_at: during })).toBe("sound_pack");
    expect(await rpc("champions_lottery_tier", { p_roll: 4, p_draws: 0, p_owned: false, p_at: during })).toBe("mythology");
  });
  it("前24抽不强制中奖，第25抽必得", async () => {
    expect(await rpc("champions_lottery_tier", { p_roll: 99, p_draws: 23, p_owned: false, p_at: during })).toBe("coins_100");
    expect(await rpc("champions_lottery_tier", { p_roll: 99, p_draws: 24, p_owned: false, p_at: during })).toBe("sound_pack");
  });
  it("已拥有音效不重复触发保底", async () => {
    expect(await rpc("champions_lottery_tier", { p_roll: 99, p_draws: 24, p_owned: true, p_at: during })).toBe("coins_100");
  });
  it("北京时间10月31日结束后自动恢复1%且无保底", async () => {
    const lastSecond = await rpc("champions_lottery_policy", { p_at: "2026-10-31T15:59:59Z" });
    const ended = await rpc("champions_lottery_policy", { p_at: "2026-10-31T16:00:00Z" });
    expect(lastSecond.promotion_active).toBe(true);
    expect(lastSecond.sound_pct).toBe(4);
    expect(ended.promotion_active).toBe(false);
    expect(ended.sound_pct).toBe(1);
    expect(await rpc("champions_lottery_tier", { p_roll: 99, p_draws: 24, p_owned: false, p_at: "2026-10-31T16:00:00Z" })).toBe("coins_100");
  });
  it("匿名不能购买抽奖券或调用旧抽奖入口绕过保底", async () => {
    await expect(rpc("purchase_lottery_ticket", { p_pool_id: "champions-2024", p_discounted: true })).rejects.toThrow();
    await expect(rpc("use_backpack_item_legacy", { p_item_id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow();
  });
});