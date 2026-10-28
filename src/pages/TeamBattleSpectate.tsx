import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, Loader2, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TbPlayer { side: number; slot: number; name: string; avatar: string | null; answered: number; correct: number }
interface TbGame { gameNo: number; status: string; scoreA: number | null; scoreB: number | null; winnerSide: number | null }
interface OpenSeries {
  id: string; kind: string; nameA: string; nameB: string;
  winsA: number; winsB: number; currentGame: number; status: string; winnerSide: number | null;
  players: TbPlayer[];
}
interface SpecState {
  ok: boolean; error?: string; kind: string; status: string;
  nameA: string; nameB: string; winsA: number; winsB: number; currentGame: number; winnerSide: number | null;
  players: TbPlayer[]; games: TbGame[];
  gameStatus: string; endsAt: string; serverNow: string;
  watch: { side: number; slot: number; name: string; answered: number; correct: number;
    question: { index: number; total: number; prompt: string; options: string[] } | null };
}

const rpc = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as any, args as any);
  if (error) throw error;
  return data as T;
};

export default function TeamBattleSpectate() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [list, setList] = useState<OpenSeries[] | null>(null);
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [slot, setSlot] = useState<number>(0);
  const [state, setState] = useState<SpecState | null>(null);
  const [now, setNow] = useState(Date.now());
  const clockOffset = useRef(0);

  useEffect(() => {
    if (!profile) return;
    rpc<OpenSeries[]>("tb_open_series" as never).then(setList).catch(() => setList([]));
  }, [profile]);

  const refresh = useCallback(async () => {
    if (!seriesId) return;
    try {
      const s = await rpc<SpecState>("tb_spectate", { p_series: seriesId, p_slot: slot });
      if (!s.ok) return;
      clockOffset.current = new Date(s.serverNow).getTime() - Date.now();
      setState(s);
    } catch { /* retry next tick */ }
  }, [seriesId, slot]);

  useEffect(() => {
    if (!seriesId) return;
    setState(null);
    refresh();
    const t = setInterval(refresh, 2000);
    const c = setInterval(() => setNow(Date.now()), 500);
    return () => { clearInterval(t); clearInterval(c); };
  }, [seriesId, slot, refresh]);

  const left = state ? Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - now - clockOffset.current) / 1000)) : 0;
  const sideCorrect = (sd: number) => state?.players.filter(p => p.side === sd).reduce((a, p) => a + p.correct, 0) ?? 0;
  const winDots = (wins: number) => [0, 1].map(i => (
    <span key={i} className={`inline-block h-3 w-3 rounded-full ${i < wins ? "bg-gold" : "bg-muted"}`} />
  ));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(seriesId ? "/team-battle/spectate" : "/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />{seriesId ? "返回列表" : "回主页"}
          </Button>
          <span className="text-xs font-semibold text-gold">TEAM BATTLE · 观赛</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {!profile && (
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground">登录后才能观赛</p>
            <Button variant="hero" onClick={() => navigate("/auth")}>去登录</Button>
          </div>
        )}

        {profile && !seriesId && (
          <>
            <div className="text-center">
              <Eye className="mx-auto h-10 w-10 text-gold" />
              <h1 className="font-gaming text-3xl">观赛大厅</h1>
              <p className="text-sm text-muted-foreground">选择一场进行中的 2v2 战队赛，实时观看任意选手的视角。</p>
            </div>
            {list === null && <Loader2 className="mx-auto h-10 w-10 animate-spin" />}
            {list !== null && list.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">现在没有进行中的比赛。</p>
            )}
            {list !== null && list.length > 0 && (
              <div className="grid gap-3">
                {list.map(s => (
                  <button key={s.id} onClick={() => { setSeriesId(s.id); setSlot(s.players[0]?.slot ?? 0); }}
                    className="flex items-center justify-between border border-border bg-card px-5 py-4 text-left transition-colors hover:border-gold">
                    <div>
                      <div className="font-gaming text-lg">{s.nameA} <span className="text-muted-foreground">vs</span> {s.nameB}</div>
                      <div className="text-xs text-muted-foreground">第 {s.currentGame} 局 · BO3 · {s.kind === "team" ? "战队对阵" : "自由组队"}</div>
                    </div>
                    <div className="font-gaming text-2xl">{s.winsA} : {s.winsB}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {profile && seriesId && !state && <Loader2 className="mx-auto h-10 w-10 animate-spin" />}

        {profile && seriesId && state && (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border border-border bg-card p-4">
              {[0, 1].map(sd => (
                <div key={sd} className={`space-y-1 ${sd === 1 ? "order-3 text-right" : ""}`}>
                  <div className="font-gaming text-lg">{sd === 0 ? state.nameA : state.nameB}</div>
                  <div className={`flex gap-1 ${sd === 1 ? "justify-end" : ""}`}>{winDots(sd === 0 ? state.winsA : state.winsB)}</div>
                  <div className="text-3xl font-gaming">{sideCorrect(sd)}</div>
                  {state.players.filter(p => p.side === sd).map(p => (
                    <div key={p.slot} className={`text-xs ${p.slot === state.watch.slot ? "text-gold font-semibold" : "text-muted-foreground"}`}>
                      {p.name} · 对 {p.correct} · {p.answered}/50
                    </div>
                  ))}
                </div>
              ))}
              <div className="order-2 text-center">
                <div className="text-xs text-muted-foreground">第 {state.currentGame} 局 · BO3</div>
                <div className="font-gaming text-xl">
                  {state.status === "active" && state.gameStatus === "active" ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "—"}
                </div>
                <div className="text-xs text-muted-foreground">{state.winsA} : {state.winsB}</div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {state.players.map(p => (
                <Button key={p.slot} size="sm" variant={p.slot === state.watch.slot ? "hero" : "outline"}
                  onClick={() => setSlot(p.slot)}>
                  <Eye className="mr-1 h-3 w-3" />{p.name}
                </Button>
              ))}
            </div>

            {state.status === "active" && state.gameStatus === "active" && state.watch.question && (
              <section className="space-y-4 border border-border bg-card p-6">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{state.watch.name} 的视角 · 第 {state.watch.question.index + 1} / 50 题</span>
                  <span>已答对 {state.watch.correct}</span>
                </div>
                <h2 className="text-center font-gaming text-4xl" data-no-translate>{state.watch.question.prompt}</h2>
                <div className="grid gap-3 sm:grid-cols-2" data-no-translate>
                  {state.watch.question.options.map(o => (
                    <div key={o} className="border border-border bg-muted/30 px-4 py-3 text-center text-sm">{o}</div>
                  ))}
                </div>
                <p className="text-center text-xs text-muted-foreground">观赛模式 · 答案不显示，选手提交后自动进入下一题</p>
              </section>
            )}

            {state.status === "active" && state.gameStatus === "active" && !state.watch.question && (
              <p className="text-center text-muted-foreground">{state.watch.name} 已答完本局 50 题，等待其他选手…</p>
            )}

            {state.status === "active" && state.gameStatus !== "active" && (
              <p className="text-center text-muted-foreground">本局结束，下一局马上开始…</p>
            )}

            {state.games.some(g => g.status === "finished") && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">局分记录</h3>
                <div className="grid gap-2">
                  {state.games.filter(g => g.status === "finished").map(g => (
                    <div key={g.gameNo} className="flex items-center justify-between border border-border bg-card px-4 py-2 text-sm">
                      <span>第 {g.gameNo} 局</span>
                      <span className="font-gaming">{g.scoreA} : {g.scoreB}</span>
                      <span className="text-muted-foreground">
                        {g.winnerSide === null ? "平局" : g.winnerSide === 0 ? `${state.nameA} 胜` : `${state.nameB} 胜`}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {state.status === "finished" && (
              <section className="space-y-4 border border-border bg-card p-8 text-center">
                <Trophy className="mx-auto h-12 w-12 text-gold" />
                <h2 className="font-gaming text-4xl">系列赛结束</h2>
                <p className="font-gaming text-2xl">{state.nameA} {state.winsA} : {state.winsB} {state.nameB}</p>
                <Button variant="outline" onClick={() => { setSeriesId(null); setState(null); rpc<OpenSeries[]>("tb_open_series" as never).then(setList).catch(() => {}); }}>返回观赛大厅</Button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
