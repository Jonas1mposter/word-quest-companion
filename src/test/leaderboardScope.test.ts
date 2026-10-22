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
  it("simon_jiang 仅排除经验榜，不影响其他玩家", () => {
    const profiles = [{ id: simon }, { id: "other" }];
    expect(eligibleForLeaderboard(profiles, "leaderboard_xp", new Set([simon]))).toEqual([{ id: "other" }]);
    for (const category of ["leaderboard_rank", "leaderboard_wins", "combo", "free_match"])
      expect(eligibleForLeaderboard(profiles, category, new Set([simon]))).toEqual(profiles);
  });
  it("线上经验榜排除名单使用稳定账号标识", async () => {
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/leaderboard_xp_excluded_ids`, {
      method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: "{}",
    });
    expect(response.ok).toBe(true);
    expect(await response.json()).toEqual([simon]);
  });
});