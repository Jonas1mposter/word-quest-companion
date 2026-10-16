import { supabase } from "@/integrations/supabase/client";
export interface ServerQuestion {
  questionIndex: number;
  total: number;
  word: string;
  options: string[];
}
export async function fetchBattleQuestion(matchId: string): Promise<ServerQuestion | null> {
  const { data, error } = await supabase.functions.invoke("match-question", { body: { matchId } });
  if (error || data?.error) throw new Error("题目加载失败，请重试");
  if (data?.done) return null;
  if (!data || !Number.isInteger(data.questionIndex) || !Array.isArray(data.options) || data.options.length !== 4 || typeof data.word !== "string") throw new Error("题目加载失败，请重试");
  return data;
}
export async function submitBattleAnswer(matchId: string, questionIndex: number, answer: string, elapsedMs: number) {
  const { data, error } = await supabase.functions.invoke("submit-answer", { body: { matchId, questionIndex, answer, elapsedMs } });
  if (error || data?.error || !data?.ok) throw new Error("答案提交失败，请重试；本题尚未跳过");
  return data as { ok: boolean; isCorrect: boolean; matchEnded?: boolean; dacForfeit?: { reason: string; meta: Record<string, number> } };
}