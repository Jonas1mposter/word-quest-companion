import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  read: vi.fn(), rpc: vi.fn(), update: vi.fn(),
}));
vi.mock('@/hooks/useLiveBan', () => ({ useLiveBan: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    getSession: () => Promise.resolve({ data: { session: { user: { id: 'user' } } } }),
  },
  from: () => ({ select: () => ({ eq: () => ({ single: mocks.read }) }), update: mocks.update }),
  rpc: mocks.rpc,
} }));
import { AuthProvider, useAuth } from '@/hooks/useAuth';

function Energy() {
  const { profile, loading } = useAuth();
  return <output>{loading ? 'loading' : profile?.energy}</output>;
}
const profile = { id: 'profile', user_id: 'user', username: 'Player', energy: 0, max_energy: 10, last_energy_restore: '2000-01-01', banned_until: null };
describe('Protected daily energy restoration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue({ data: profile, error: null });
  });
  it('uses only server-returned energy and does not directly PATCH energy or restore date', async () => {
    mocks.rpc.mockResolvedValue({ data: { ...profile, energy: 7 }, error: null });
    render(<AuthProvider><Energy /></AuthProvider>);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('7'));
    expect(mocks.rpc).toHaveBeenCalledWith('restore_daily_energy');
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it('keeps the actual profile balance when server restoration fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'Denied' } });
    render(<AuthProvider><Energy /></AuthProvider>);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('0'));
    expect(mocks.update).not.toHaveBeenCalled();
  });
});