import { describe, expect, it } from "vitest";
async function rpc(name: string, body: Record<string, unknown>) {
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST",
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
const t = (roll: number, m = 0, s = 0, my = 0, l = 0, left = true) => rpc("glory_crown_tier", { p_roll: roll, p_since_main: m, p_since_sub: s, p_since_myth: my, p_since_leg: l, p_main_left: left, p_sub_left: left, p_myth_left: left, p_leg_left: left });
describe("荣光铸冠概率与保底", () => {
  it("主套1%、副套2%、神话4%、传说5%", async () => {
    expect(await t(0.999)).toBe("main_sound"); expect(await t(1)).toBe("sub_sound");
    expect(await t(2.999)).toBe("sub_sound"); expect(await t(3)).toBe("mythology");
    expect(await t(6.999)).toBe("mythology"); expect(await t(7)).toBe("legendary");
    expect(await t(11.999)).toBe("legendary"); expect(await t(12)).toBe("coins_200");
  });
  it("第20抽必出传说", async () => { expect(await t(99, 0, 0, 0, 18)).toBe("coins_100"); expect(await t(99, 0, 0, 0, 19)).toBe("legendary"); });
  it("第25抽必出神话", async () => { expect(await t(99, 0, 0, 23)).toBe("coins_100"); expect(await t(99, 0, 0, 24)).toBe("mythology"); });
  it("第50抽必得副套", async () => { expect(await t(99, 0, 48)).toBe("coins_100"); expect(await t(99, 0, 49)).toBe("sub_sound"); });
  it("第100抽必得主套", async () => { expect(await t(99, 98)).toBe("coins_100"); expect(await t(99, 99, 49, 24, 19)).toBe("main_sound"); });
  it("全部拥有时不触发保底", async () => { expect(await t(99, 99, 49, 24, 19, false)).toBe("coins_100"); });
  it("匿名不能开奖", async () => { await expect(rpc("glory_crown_draw", { p_item_id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow(); });
});
