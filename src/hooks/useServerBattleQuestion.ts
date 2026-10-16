import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBattleQuestion, ServerQuestion } from "@/lib/serverBattle";

export function useServerBattleQuestion(matchId?: string) {
  const [question, setQuestion] = useState<ServerQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (!matchId) return;
    const request = ++generation.current;
    setLoading(true); setError(null);
    try {
      const next = await fetchBattleQuestion(matchId);
      if (request === generation.current) setQuestion(next);
    } catch (err) {
      if (request === generation.current) setError(err instanceof Error ? err.message : "题目加载失败，请重试");
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [matchId]);
  useEffect(() => { setQuestion(null); void load(); return () => { generation.current++; }; }, [load]);
  return { question, questionError: error, questionLoading: loading, loadQuestion: load };
}