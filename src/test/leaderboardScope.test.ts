import { describe, expect, it } from "vitest";
import { leaderboardGrades, leaderboardZone, eligibleForLeaderboard } from "../../supabase/functions/_shared/leaderboardScope";

const simon = "bcfb301e-e3e6-48cd-9ef6-6b42dcee8326";
describe("高中合榜与经验榜专用排除", () => {
  it("G9–G12 查询同一高中范围，奖励只分一个区", () => {
    for (const grade of [9, 10, 11, 12]) {
      expect(leaderboardGrades(grade)).toEqual([9, 10, 11, 12]);
      expect(leaderboardZone(grade)).toBe(9);
    }
    expect(new Set([9, 10, 11, 12].map(leaderboardZone)).size).toBe(1);
  });
  it("其他年级不参与高中合榜", () => {
    for (const grade of [1, 6, 7, 8]) expect(leaderboardGrades(grade)).toEqual([grade]);
  });
  it("simon_jiang 排除所有排行榜，不影响其他玩家", () => {
    const profiles = [{ id: simon }, { id: "other" }];
    expect(eligibleForLeaderboard(profiles, "leaderboard_xp", new Set([simon]))).toEqual([{ id: "other" }]);
    for (const category of ["leaderboard_rank", "leaderboard_wins", "combo", "free_match"])
      expect(eligibleForLeaderboard(profiles, category, new Set([simon]))).toEqual(profiles);
  });
  it("线上排除名单使用稳定账号标识，simon_jiang 在通用排除名单中", async () => {
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
    const [xpRes, generalRes] = await Promise.all([
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/leaderboard_xp_excluded_ids`, { method: "POST", headers, body: "{}" }),
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/leaderboard_excluded_ids`, { method: "POST", headers, body: "{}" }),
    ]);
    expect(xpRes.ok).toBe(true);
    expect(await xpRes.json()).toEqual([simon]);
    expect(generalRes.ok).toBe(true);
    const general = (await generalRes.json()).map((r: any) => (typeof r === "string" ? r : r?.leaderboard_excluded_ids ?? r?.id));
    expect(general).toContain(simon);
  });
});