import { describe, expect, it, vi } from "vitest";
import { settleEmptyMatch } from "../../supabase/functions/_shared/emptyMatch";

describe("无答题对局结算保护", () => {
  it.each(["1v1", "2v2"])("%s全场无答题时没有胜者、豆子或经验", async mode => {
    const rpc = vi.fn().mockResolvedValue({ data: { handled: true }, error: null });
    const result = await settleEmptyMatch({ rpc }, "match", mode, null);
    expect(result).toMatchObject({ winnerId: null, winnerTeam: null, coinsEarned: 0, xpEarned: 0 });
    expect(rpc).toHaveBeenCalledWith("complete_empty_match", { p_match_id: "match", p_forfeiter_id: null });
  });
  it("主动退赛传入本人身份，由服务器保留扣分，但不发胜者收益", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { handled: true }, error: null });
    const result = await settleEmptyMatch({ rpc }, "match", "1v1", "quitter");
    expect(rpc).toHaveBeenCalledWith("complete_empty_match", { p_match_id: "match", p_forfeiter_id: "quitter" });
    expect(result?.coinsEarned).toBe(0);
    expect(result?.winnerId).toBeNull();
  });
  it("已有答题记录的0比0仍走正常结算", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { handled: false }, error: null });
    expect(await settleEmptyMatch({ rpc }, "match", "1v1", null)).toBeNull();
  });
  it("无法验证答题记录时拒绝发奖", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(settleEmptyMatch({ rpc }, "match", "2v2", null)).rejects.toThrow("unavailable");
  });
});