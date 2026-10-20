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
  it("主套2%、副套4%、神话8%、传说10%", async () => {
    expect(await t(1.999)).toBe("main_sound"); expect(await t(2)).toBe("sub_sound");
    expect(await t(5.999)).toBe("sub_sound"); expect(await t(6)).toBe("mythology");
    expect(await t(13.999)).toBe("mythology"); expect(await t(14)).toBe("legendary");
    expect(await t(23.999)).toBe("legendary"); expect(await t(24)).toBe("coins_200");
  });
  it("第14抽必出传说", async () => { expect(await t(99, 0, 0, 0, 12)).toBe("coins_100"); expect(await t(99, 0, 0, 0, 13)).toBe("legendary"); });
  it("第17抽必出神话", async () => { expect(await t(99, 0, 0, 15)).toBe("coins_100"); expect(await t(99, 0, 0, 16)).toBe("mythology"); });
  it("第34抽必得副套", async () => { expect(await t(99, 0, 32)).toBe("coins_100"); expect(await t(99, 0, 33)).toBe("sub_sound"); });
  it("第67抽必得主套", async () => { expect(await t(99, 65)).toBe("coins_100"); expect(await t(99, 66, 33, 16, 13)).toBe("main_sound"); });
  it("全部拥有时不触发保底", async () => { expect(await t(99, 66, 33, 16, 13, false)).toBe("coins_100"); });
  it("匿名不能开奖", async () => { await expect(rpc("glory_crown_draw", { p_item_id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow(); });
});
