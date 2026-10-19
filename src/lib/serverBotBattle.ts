import { supabase } from '@/integrations/supabase/client';
import type { BattleAnswerResult, ServerQuestion } from './serverBattle';

export interface BotResult {
  ok: boolean; result: 'win' | 'draw' | 'loss'; playerScore: number; botScore: number;
  xpEarned: number; coinsEarned: number; forfeited?: boolean;
}
export async function botAction<T>(sessionId: string, action: string, values: Record<string, unknown> = {}): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.functions.invoke('bot-battle', { body: { sessionId, action, ...values } });
    if (!error && !data?.error) return data as T;
    if (data?.error || attempt === 2) throw new Error('请求未能确认，请重试');
    await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)));
  }
  throw new Error('请求未能确认，请重试');
}
export const botQuestion = (id: string) => botAction<ServerQuestion & { done?: boolean }>(id, 'question');
export const botAnswer = (id: string, questionIndex: number, answer: string) => botAction<BattleAnswerResult & { playerScore: number; botScore: number }>(id, 'answer', { questionIndex, answer });
export async function botAudio(id: string, questionIndex: number) {
  const blob = await botAction<Blob>(id, 'audio', { questionIndex });
  if (!(blob instanceof Blob) || !blob.size) throw new Error('发音加载失败，请点击重试');
  return blob;
}