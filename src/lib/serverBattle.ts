import { supabase } from "@/integrations/supabase/client";
export interface ServerQuestion {
  questionIndex: number;
  total: number;
  word: string;
  options: string[];
}
// Both server calls are idempotent (same issued question / duplicate-safe submit), so retry on flaky networks.
async function invokeWithRetry(name: string, body: Record<string, unknown>, attempts = 3) {
  let last: { data: any; error: any } = { data: null, error: null };
  for (let i = 0; i < attempts; i++) {
    try {
      last = await supabase.functions.invoke(name, { body });
    } catch (e) {
      last = { data: null, error: e };
    }
    if (!last.error && !last.data?.error) return last;
    if (last.data?.error) return last; // server rejected: don't retry
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)));
  }
  return last;
}
export async function fetchBattleQuestion(matchId: string): Promise<ServerQuestion | null> {
  const { data, error } = await invokeWithRetry("match-question", { matchId });
  if (error || data?.error) throw new Error("题目加载失败，请重试");
  if (data?.done) return null;
  if (!data || !Number.isInteger(data.questionIndex) || !Number.isInteger(data.total) || !Array.isArray(data.options) || data.options.length !== 4 || data.options.some((option: unknown) => typeof option !== "string") || typeof data.word !== "string") throw new Error("题目加载失败，请重试");
  return { questionIndex: data.questionIndex, total: data.total, word: data.word, options: data.options };
}
export async function submitBattleAnswer(matchId: string, questionIndex: number, answer: string, elapsedMs: number) {
  const { data, error } = await invokeWithRetry("submit-answer", { matchId, questionIndex, answer, elapsedMs });
  if (error || data?.error || !data?.ok) throw new Error("答案提交失败，请重试；本题尚未跳过");
  return data as { ok: boolean; isCorrect: boolean; matchEnded?: boolean; dacForfeit?: { reason: string; meta: Record<string, number> } };
}
