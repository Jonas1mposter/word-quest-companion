import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ search: vi.fn(), cancel: vi.fn() }));
vi.mock('@/lib/matchmaking', () => ({ searchMatch: mocks.search, cancelSearch: mocks.cancel }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  removeChannel: vi.fn(), channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
  from: () => { const q = { select: () => q, eq: () => q, single: () => Promise.resolve({data:{player1_id:'p1',player2_id:null}}) }; return q; },
} }));
import { useMatchQueue } from '@/hooks/useMatchQueue';
describe('30秒补位入口', () => {
  beforeEach(() => { vi.useFakeTimers(); mocks.search.mockReset(); mocks.cancel.mockReset(); mocks.cancel.mockResolvedValue(null); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it.each([{mode:'1v1' as const,matchType:'ranked' as const,partyId:null}, {mode:'1v1' as const,matchType:'free' as const,partyId:null}, {mode:'2v2' as const,matchType:'ranked' as const,partyId:'party'}])('$mode $matchType 持续至30秒并只跳转一次', async options => {
    const start=Date.now(); mocks.search.mockImplementation(async () => Date.now()-start>=30000?'fallback-match':null);
    const found=vi.fn(); const {result}=renderHook(() => useMatchQueue({...options,profileId:'p1',grade:7,eloRating:1000,enabled:true,onMatchFound:found}));
    await act(async () => { await result.current.joinQueue(); await vi.advanceTimersByTimeAsync(29000); });
    expect(found).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(found).toHaveBeenCalledTimes(1); expect(found).toHaveBeenCalledWith('fallback-match','bot-2');
    const requests=mocks.search.mock.calls.map(([o])=>o);
    expect(new Set(requests.map(o=>o.requestId)).size).toBe(1);
    expect(requests.every(o=>o.mode===options.mode && o.matchType===options.matchType && o.partyId===options.partyId)).toBe(true);
    expect(mocks.cancel).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(6000); }); expect(found).toHaveBeenCalledTimes(1);
  });
  it('取消撞上已创建对局时恢复同一局，不返回新搜索', async () => {
    mocks.search.mockResolvedValue(null); mocks.cancel.mockResolvedValue('matched-before-cancel');
    const found=vi.fn(); const {result}=renderHook(() => useMatchQueue({profileId:'p1',grade:7,matchType:'ranked',eloRating:1000,enabled:true,onMatchFound:found}));
    await act(async () => { await result.current.joinQueue(); expect(await result.current.leaveQueue()).toBe(false); });
    expect(found).toHaveBeenCalledWith('matched-before-cancel','recovered');
  });
});