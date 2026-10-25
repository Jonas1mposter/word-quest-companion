import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  read: vi.fn(), getSession: vi.fn(), rpc: vi.fn(),
  callback: undefined as undefined | ((event: string, session: any) => void),
}));
vi.mock('@/hooks/useLiveBan', () => ({ useLiveBan: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    onAuthStateChange: (callback: typeof mocks.callback) => {
      mocks.callback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    },
    getSession: mocks.getSession,
    signOut: vi.fn().mockResolvedValue({}),
  },
  from: () => ({ select: () => ({ eq: () => ({ single: mocks.read }) }) }),
  rpc: mocks.rpc,
} }));
import { AuthProvider, useAuth } from '@/hooks/useAuth';
const session = { user: { id: 'user' }, access_token: 'test' };
const profile = { id: 'profile', user_id: 'user', username: 'Player', energy: 4, last_energy_restore: '2099-01-01', banned_until: null };
function State() {
  const { loading, loadingError, profile, user, retryLoading } = useAuth();
  return <><output>{loading ? 'pending' : loadingError ? 'error' : profile ? `ready:${profile.energy}` : user ? 'no-profile' : 'signed-out'}</output>
    <button onClick={() => void retryLoading()}>retry</button></>;
}
describe('Auth startup recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callback = undefined;
    mocks.getSession.mockResolvedValue({ data: { session }, error: null });
    mocks.read.mockResolvedValue({ data: profile, error: null });
  });
  afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it('exposes rejected profile reads and retries instead of remaining without a profile', async () => {
    mocks.read.mockRejectedValueOnce(new Error('offline'));
    render(<AuthProvider><State /></AuthProvider>);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('error'));
    fireEvent.click(screen.getByText('retry'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:4'));
  });
  it('bounds a profile transport that never responds', async () => {
    vi.useFakeTimers();
    mocks.read.mockReturnValue(new Promise(() => {}));
    render(<AuthProvider><State /></AuthProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(10001); });
    expect(screen.getByRole('status')).toHaveTextContent('error');
  });
  it('bounds a stalled session lookup', async () => {
    vi.useFakeTimers();
    mocks.getSession.mockReturnValue(new Promise(() => {}));
    render(<AuthProvider><State /></AuthProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(10001); });
    expect(screen.getByRole('status')).toHaveTextContent('error');
  });
  it('does not let Microsoft enrichment block a verified profile', async () => {
    mocks.getSession.mockReturnValue(new Promise(() => {}));
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<AuthProvider><State /></AuthProvider>);
    act(() => mocks.callback?.('SIGNED_IN', { ...session, provider_token: 'test' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('ready:4'));
  });
  it('keeps verified energy when the restore operation stalls', async () => {
    vi.useFakeTimers();
    mocks.read.mockResolvedValue({ data: { ...profile, last_energy_restore: '2000-01-01' }, error: null });
    mocks.rpc.mockReturnValue(new Promise(() => {}));
    render(<AuthProvider><State /></AuthProvider>);
    await act(async () => { await vi.advanceTimersByTimeAsync(5001); });
    expect(screen.getByRole('status')).toHaveTextContent('ready:4');
  });
  it('does not restore an old profile after sign-out', async () => {
    let resolveRead: ((value: any) => void) | undefined;
    mocks.read.mockReturnValue(new Promise(resolve => { resolveRead = resolve; }));
    render(<AuthProvider><State /></AuthProvider>);
    await waitFor(() => expect(mocks.read).toHaveBeenCalled());
    act(() => mocks.callback?.('SIGNED_OUT', null));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('signed-out'));
    await act(async () => resolveRead?.({ data: profile, error: null }));
    expect(screen.getByRole('status')).toHaveTextContent('signed-out');
  });
});