import { describe, it, expect, vi, beforeEach } from 'vitest';
const invoke = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke } } }));
import { botAction, botAnswer, botQuestion, botAudio } from '@/lib/serverBotBattle';
beforeEach(() => invoke.mockReset());
describe('人机服务器协议', () => {
  it('只提交题号和答案，不接受客户端分数或奖励', async () => {
    invoke.mockResolvedValue({ data: { ok: true, isCorrect: false, playerScore: 0, botScore: 1 }, error: null });
    const result = await botAnswer('session', 2, 'pear');
    expect(invoke).toHaveBeenCalledWith('bot-battle', { body: { sessionId: 'session', action: 'answer', questionIndex: 2, answer: 'pear' } });
    expect(result.playerScore).toBe(0);
  });
  it('只领取当前题', async () => {
    invoke.mockResolvedValue({ data: { questionIndex: 0 }, error: null });
    await botQuestion('session');
    expect(invoke).toHaveBeenCalledWith('bot-battle', { body: { sessionId: 'session', action: 'question' } });
  });
  it('听力只接收字节', async () => {
    const blob = new Blob(['audio']);
    invoke.mockResolvedValue({ data: blob, error: null });
    expect(await botAudio('session', 3)).toBe(blob);
  });
  it('服务端拒绝不继续重试', async () => {
    invoke.mockResolvedValue({ data: { error: 'Answers incomplete' }, error: null });
    await expect(botAction('session', 'finish')).rejects.toThrow();
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});