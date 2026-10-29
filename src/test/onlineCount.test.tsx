import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ channel: vi.fn(), removeChannel: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: mocks }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'a' } }) }));
import { useOnlinePresence } from '@/hooks/useOnlineCount';

function connection() {
  let sync = () => {};
  let status: (value: string) => Promise<void> = async () => {};
  let state: Record<string, unknown[]> = {};
  const channel = {
    on: vi.fn((_type, _filter, callback) => { sync = callback; return channel; }),
    subscribe: vi.fn(callback => { status = callback; return channel; }),
    track: vi.fn().mockResolvedValue('ok'),
    presenceState: () => state,
  };
  return { channel, status: (value: string) => status(value),
    sync: (next: Record<string, unknown[]>) => { state = next; sync(); } };
}

describe('Site-wide online presence', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('counts two players once each even when one has multiple tabs', async () => {
    const room = connection();
    mocks.channel.mockReturnValue(room.channel);
    const { result } = renderHook(() => useOnlinePresence('a'));
    await act(() => room.status('SUBSCRIBED'));
    act(() => room.sync({ a: [{}, {}], b: [{}] }));
    expect(result.current).toBe(2);
    act(() => room.sync({ a: [{}, {}] }));
    expect(result.current).toBe(1);
  });

  it('removes stale totals on disconnect and tracks again on reconnect', async () => {
    const room = connection();
    mocks.channel.mockReturnValue(room.channel);
    const { result } = renderHook(() => useOnlinePresence('a'));
    await act(() => room.status('SUBSCRIBED'));
    act(() => room.sync({ a: [{}], b: [{}] }));
    await act(() => room.status('CHANNEL_ERROR'));
    expect(result.current).toBeNull();
    await act(() => room.status('SUBSCRIBED'));
    act(() => room.sync({ a: [{}], b: [{}], c: [{}] }));
    expect(result.current).toBe(3);
    expect(room.channel.track).toHaveBeenCalledTimes(2);
  });

  it('cleans up on sign-out and ignores late callbacks from the old account', async () => {
    const room = connection();
    mocks.channel.mockReturnValue(room.channel);
    const { result, rerender } = renderHook(({ id }) => useOnlinePresence(id), { initialProps: { id: 'a' as string | null } });
    act(() => room.sync({ a: [{}] }));
    rerender({ id: null });
    act(() => room.sync({ a: [{}], b: [{}] }));
    await act(() => room.status('SUBSCRIBED'));
    expect(result.current).toBeNull();
    expect(mocks.removeChannel).toHaveBeenCalledWith(room.channel);
    expect(room.channel.track).not.toHaveBeenCalled();
  });

  it('does not connect signed-out visitors', () => {
    const { result } = renderHook(() => useOnlinePresence(null));
    expect(result.current).toBeNull();
    expect(mocks.channel).not.toHaveBeenCalled();
  });
});