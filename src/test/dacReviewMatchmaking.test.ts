import { describe, it, expect, vi } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
import { searchMatch } from '@/lib/matchmaking';
describe('ranked review enforcement feedback', () => {
  it('shows pending review instead of incorrectly blaming the network', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: new Response(JSON.stringify({ error: 'DAC_REVIEW_REQUIRED: pending' }), { status: 409 }) } });
    await expect(searchMatch({ requestId: 'req', mode: '1v1', matchType: 'ranked', subject: 'mixed' })).rejects.toThrow('排位资格正在等待 DAC 管理员复核');
  });
});