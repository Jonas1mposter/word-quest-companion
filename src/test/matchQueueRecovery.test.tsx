import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), subscribe: vi.fn(), removeChannel: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: mocks.rpc, functions: { invoke: mocks.invoke }, from: mocks.from, removeChannel: mocks.removeChannel,
  channel: () => { const c = { on: () => c, subscribe: () => { mocks.subscribe(); return c; } }; return c; },
} }));
import { useMatchQueue } from "@/hooks/useMatchQueue";
describe("取消匹配隔离迟到请求", () => {
  beforeEach(() => {
    vi.useFakeTimers(); mocks.rpc.mockReset(); mocks.invoke.mockReset(); mocks.invoke.mockResolvedValue({data: {matchId: null}, error: null}); mocks.subscribe.mockClear();
    mocks.from.mockImplementation(() => { const q = { delete: () => q, eq: () => q, then: (resolve: (value: unknown) => void) => Promise.resolve({ error: null }).then(resolve) }; return q; });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it("取消后旧匹配请求返回不能重新订阅或跳转", async () => {
    let resolveRpc: (value: unknown) => void = () => {};
    mocks.invoke.mockImplementationOnce(() => new Promise(resolve => { resolveRpc = resolve; }));
    const found = vi.fn();
    const { result } = renderHook(() => useMatchQueue({ profileId: "p1", grade: 7, matchType: "ranked", eloRating: 1000, enabled: true, onMatchFound: found }));
    let pending: Promise<unknown> | undefined;
    act(() => { pending = result.current.joinQueue(); });
    await act(async () => { await result.current.leaveQueue(); });
    await act(async () => { resolveRpc({ data: {matchId: "late-match"}, error: null }); await pending; });
    expect(found).not.toHaveBeenCalled();
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(result.current.isSearching).toBe(false);
  });
  it("卸载后旧请求不能重新启动后台搜索", async () => {
    let resolveRpc: (value: unknown) => void = () => {};
    mocks.invoke.mockImplementationOnce(() => new Promise(resolve => { resolveRpc = resolve; }));
    const { result, unmount } = renderHook(() => useMatchQueue({ profileId: "p1", grade: 7, matchType: "ranked", eloRating: 1000, enabled: true, onMatchFound: vi.fn() }));
    let pending: Promise<unknown> | undefined;
    act(() => { pending = result.current.joinQueue(); });
    unmount();
    await act(async () => { resolveRpc({ data: null, error: null }); await pending; await vi.advanceTimersByTimeAsync(6000); });
    expect(mocks.subscribe).not.toHaveBeenCalled();
    expect(mocks.invoke.mock.calls.filter(([, args]) => args.body.action === 'search')).toHaveLength(1);
    expect(mocks.invoke.mock.calls.filter(([, args]) => args.body.action === 'cancel')).toHaveLength(1);
  });
});