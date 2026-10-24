import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
const action = vi.hoisted(() => vi.fn());
const question = vi.hoisted(() => vi.fn());
const answer = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: { id: 'p', username: 'Player', grade: 7 }, refreshProfile: vi.fn() }) }));
vi.mock('@/hooks/useMatchSounds', () => ({ useMatchSounds: () => ({ playVictory: vi.fn(), playDefeat: vi.fn() }), useSoundVariants: () => ({ variants: null, selected: null }), setSoundVariant: vi.fn() }));
vi.mock('@/lib/serverBotBattle', () => ({ botAction: action, botQuestion: question, botAnswer: answer, botAudio: vi.fn() }));
vi.mock('@/components/battle/DacBadge', () => ({ default: ({ onForfeit }: { onForfeit?: (reason: string, meta: Record<string, number>) => void }) => onForfeit ? <button onClick={() => onForfeit('synthetic_click', { untrusted: 2 })}>检测脚本</button> : null }));
vi.mock('@/components/battle/KillStreakBanner', () => ({ default: () => null }));
vi.mock('@/components/battle/ServerBattleQuizCard', () => ({ default: ({ onAnswer }: { onAnswer: (answer: string) => Promise<unknown> }) => <button onClick={() => void onAnswer('苹果')}>提交题目</button> }));
import BotBattle from '@/components/BotBattle';
describe('人机违规终止', () => {
  it('违规退出调用服务器并不走正常发奖结算', async () => {
    action.mockImplementation((_id, type) => Promise.resolve(type === 'start' ? { total: 10, startedAt: new Date().toISOString() } : { ok: true, result: 'loss', forfeited: true, playerScore: 0, botScore: 0, xpEarned: 0, coinsEarned: 0 }));
    question.mockResolvedValue({ questionIndex: 0, total: 10, quizType: 'meaning', prompt: 'apple', options: ['苹果', '梨', '香蕉', '葡萄'] });
    render(<BotBattle onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('中等'));
    await waitFor(() => expect(screen.getByText('检测脚本')).toBeInTheDocument(), { timeout: 6000 });
    fireEvent.click(screen.getByText('检测脚本'));
    await waitFor(() => expect(action).toHaveBeenCalledWith(expect.any(String), 'forfeit', { reason: 'synthetic_click', meta: { untrusted: 2 } }));
    expect(action.mock.calls.some(call => call[1] === 'finish')).toBe(false);
    expect(answer).not.toHaveBeenCalled();
  }, 10000);
});