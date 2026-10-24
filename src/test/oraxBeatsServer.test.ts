import { describe, expect, it } from "vitest";
async function rpc(name: string, body: Record<string, unknown>) {
  const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/${name}`, { method: "POST",
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body) });
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}
const t = (roll: number, m = 0, s = 0, left = true) => rpc("orax_beats_tier", { p_roll: roll, p_since_main: m, p_since_sub: s, p_main_left: left, p_sub_left: left });

describe("颗秒音浪概率与保底", () => {
  it("主套2%、副套5%、200豆30%、100豆63%", async () => {
    expect(await t(1.999)).toBe("main_sound"); expect(await t(2)).toBe("sub_sound");
    expect(await t(6.999)).toBe("sub_sound"); expect(await t(7)).toBe("coins_200");
    expect(await t(36.999)).toBe("coins_200"); expect(await t(37)).toBe("coins_100");
  }, 20000);
  it("第20抽必得副套", async () => { expect(await t(99, 0, 18)).toBe("coins_100"); expect(await t(99, 0, 19)).toBe("sub_sound"); });
  it("第50抽必得主套", async () => { expect(await t(99, 48)).toBe("coins_100"); expect(await t(99, 49)).toBe("main_sound"); });
  it("全部拥有时不触发保底", async () => { expect(await t(99, 49, 19, false)).toBe("coins_100"); });
  it("匿名不能开奖", async () => { await expect(rpc("orax_beats_draw", { p_item_id: "00000000-0000-0000-0000-000000000000" })).rejects.toThrow(); });
});
