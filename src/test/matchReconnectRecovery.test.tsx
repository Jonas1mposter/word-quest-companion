import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ matchError: false, or: vi.fn(), invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: mocks.invoke },
  from: (table: string) => {
    const value = table === "ranked_matches"
      ? { data: mocks.matchError ? null : [{ id: "match", mode: "2v2", match_type: "ranked", subject: "math", player1_id: "p1", player2_id: "p2", player3_id: "p3", player4_id: "p4", team1_score: 8, team2_score: 3, started_at: new Date(Date.now() - 60000).toISOString() }], error: mocks.matchError ? { message: "offline" } : null }
      : table === "profiles" ? { data: { username: "Opponent" } } : { count: 4 };
    const q = { select: () => q, eq: () => q, or: (filter: string) => { mocks.or(filter); return q; }, order: () => q, limit: () => q, single: () => q, then: (resolve: (v: unknown) => void) => Promise.resolve(value).then(resolve) };
    return q;
  },
} }));
import { useMatchReconnect } from "@/hooks/useMatchReconnect";
describe("2v2重连与故障恢复", () => {
  beforeEach(() => { mocks.matchError = false; mocks.or.mockClear(); mocks.invoke.mockReset(); });
  afterEach(cleanup);
  it.each(["p3", "p4"])("%s同样能发现2v2并恢复服务器剩余时间", async profileId => {
    const { result } = renderHook(() => useMatchReconnect({ profileId }));
    await waitFor(() => expect(result.current.activeMatch?.mode).toBe("2v2"));
    expect(mocks.or).toHaveBeenCalledWith(`player1_id.eq.${profileId},player2_id.eq.${profileId},player3_id.eq.${profileId},player4_id.eq.${profileId}`);
    expect(result.current.activeMatch?.timeRemaining).toBeLessThanOrEqual(240);
    expect(result.current.activeMatch?.timeRemaining).toBeGreaterThan(238);
    expect(result.current.activeMatch?.myScore).toBe(profileId === "p3" ? 8 : 3);
  });
  it("断网读取失败保留已有重连提示", async () => {
    const { result } = renderHook(() => useMatchReconnect({ profileId: "p3" }));
    await waitFor(() => expect(result.current.activeMatch?.id).toBe("match"));
    mocks.matchError = true;
    await act(async () => { await result.current.checkForActiveMatch(); });
    expect(result.current.activeMatch?.id).toBe("match");
  });
  it("退赛未获确认不能清除活动对局", async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: { message: "offline" } });
    const { result } = renderHook(() => useMatchReconnect({ profileId: "p3" }));
    await waitFor(() => expect(result.current.activeMatch?.id).toBe("match"));
    await act(async () => { await expect(result.current.dismissMatch()).rejects.toThrow("退赛未能确认"); });
    expect(result.current.activeMatch?.id).toBe("match");
    expect(mocks.invoke).toHaveBeenCalledWith("process-match", { body: { matchId: "match", forfeit: { reason: "surrender", meta: {} } } });
  });
});