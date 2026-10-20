import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBattleQuestion, ServerQuestion } from "@/lib/serverBattle";

export function useServerBattleQuestion(matchId?: string) {
  const [question, setQuestion] = useState<ServerQuestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const load = useCallback(async () => {
    if (!matchId) return;
    if (inFlight.current) return inFlight.current;
    const work = (async () => {
    const request = ++generation.current;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setLoading(true); setError(null);
    try {
      const next = await Promise.race([
        fetchBattleQuestion(matchId),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("题目加载失败，请重试")), 15000);
        }),
      ]);
      if (!next) throw new Error("题目加载失败，请重试");
      if (request === generation.current) setQuestion(next);
    } catch (err) {
      if (request === generation.current) setError(err instanceof Error ? err.message : "题目加载失败，请重试");
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      if (request === generation.current) setLoading(false);
    }
    })();
    inFlight.current = work;
    try { await work; } finally { if (inFlight.current === work) inFlight.current = null; }
  }, [matchId]);
  useEffect(() => {
    inFlight.current = null;
    setQuestion(null);
    void load();
    return () => { generation.current++; inFlight.current = null; };
  }, [load]);
  useEffect(() => {
    if (!error) return;
    const recover = () => { if (!document.hidden) void load(); };
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", recover);
    return () => { window.removeEventListener("online", recover); document.removeEventListener("visibilitychange", recover); };
  }, [error, load]);
  return { question, questionError: error, questionLoading: loading, loadQuestion: load };
}