import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), remove: vi.fn(), listener: undefined as undefined | (() => void) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ single: mocks.read }) }) }) }),
  channel: () => ({ on: (_type: string, _config: unknown, listener: () => void) => {
    mocks.listener = listener; return { subscribe: () => ({}) };
  } }), removeChannel: mocks.remove,
} }));
import { useLiveBan } from '@/hooks/useLiveBan';
const active = { id: 'profile', username: '000243', banned_until: '2099-11-19T06:35:15Z', ban_reason: '管理员封禁' };
describe('在线封禁', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.read.mockResolvedValue({ data: { ...active, banned_until: null }, error: null }); });
  afterEach(() => { vi.useRealTimers(); });
  it('登录未刷新时实时更新也会执行封禁，重复通知不重复退出', async () => {
    const onBan = vi.fn();
    const { unmount } = renderHook(() => useLiveBan('user', onBan));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    mocks.read.mockResolvedValue({ data: active, error: null });
    await act(async () => { mocks.listener?.(); });
    expect(onBan).toHaveBeenCalledWith({ profileId: 'profile', username: '000243', bannedUntil: active.banned_until, reason: active.ban_reason });
    await act(async () => { mocks.listener?.(); });
    expect(onBan).toHaveBeenCalledTimes(1);
    unmount(); expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
  it('通知丢失时10秒备用检查发现封禁', async () => {
    vi.useFakeTimers();
    const onBan = vi.fn();
    const { unmount } = renderHook(() => useLiveBan('user', onBan));
    await act(async () => { await Promise.resolve(); });
    mocks.read.mockResolvedValue({ data: active, error: null });
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(onBan).toHaveBeenCalledTimes(1);
    unmount();
  });
  it('重新联网立即检查，过期封禁不退出', async () => {
    const onBan = vi.fn();
    const { unmount } = renderHook(() => useLiveBan('user', onBan));
    await act(async () => { await Promise.resolve(); });
    mocks.read.mockResolvedValue({ data: { ...active, banned_until: '2020-01-01T00:00:00Z' }, error: null });
    await act(async () => { window.dispatchEvent(new Event('online')); });
    expect(onBan).not.toHaveBeenCalled();
    mocks.read.mockResolvedValue({ data: active, error: null });
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(onBan).toHaveBeenCalledTimes(1);
    unmount();
  });
  it('页面退出后的迟到响应不会封禁下一个会话', async () => {
    let resolve: (result: unknown) => void = () => {};
    mocks.read.mockReturnValue(new Promise(r => { resolve = r; }));
    const onBan = vi.fn();
    const { unmount } = renderHook(() => useLiveBan('user', onBan));
    unmount();
    await act(async () => { resolve({ data: active, error: null }); });
    expect(onBan).not.toHaveBeenCalled();
  });
});