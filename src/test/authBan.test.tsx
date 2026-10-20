import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BanInfo } from '@/components/BanScreen';
const mocks = vi.hoisted(() => ({ ban: undefined as undefined | ((info: BanInfo) => void), signOut: vi.fn().mockResolvedValue({}), show: vi.fn() }));
vi.mock('@/components/BanScreen', () => ({ showBanScreen: mocks.show }));
vi.mock('@/hooks/useLiveBan', () => ({ useLiveBan: (_id: string, callback: (info: BanInfo) => void) => { mocks.ban = callback; } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    getSession: () => Promise.resolve({ data: { session: { user: { id: 'user' }, access_token: 'test' } } }), signOut: mocks.signOut },
  from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: 'profile', user_id: 'user', username: 'Player', last_energy_restore: '2099-01-01', banned_until: null }, error: null }) }) }) }),
} }));
import { AuthProvider, useAuth } from '@/hooks/useAuth';
function State() {
  const { user, session, profile } = useAuth();
  return <div data-testid="state">{JSON.stringify({ user: !!user, session: !!session, profile: !!profile })}</div>;
}
describe('封禁清除在线状态', () => {
  it('实时封禁不等退出请求完成就清除账号、会话和资料', async () => {
    render(<AuthProvider><State /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('{"user":true,"session":true,"profile":true}'));
    const info = { profileId: 'profile', bannedUntil: '2099-11-19T06:35:15Z' };
    act(() => { mocks.ban?.(info); });
    expect(screen.getByTestId('state').textContent).toBe('{"user":false,"session":false,"profile":false}');
    expect(mocks.show).toHaveBeenCalledWith(info);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});