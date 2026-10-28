import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Crown, Eye, Loader2, Pause, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useComboFx } from "@/hooks/useComboFx";
import KillStreakBanner from "@/components/battle/KillStreakBanner";
import SoundVariantSwitcher from "@/components/battle/SoundVariantSwitcher";

interface TbPlayer { side: number; slot: number; name: string; avatar: string | null; answered: number; correct: number }
interface TbGame { gameNo: number; status: string; scoreA: number | null; scoreB: number | null; timeA: number | null; timeB: number | null; winnerSide: number | null }
interface TbState {
  ok: boolean; error?: string; kind: string; status: string;
  nameA: string; nameB: string; winsA: number; winsB: number; currentGame: number; winnerSide: number | null;
  breakEndsAt: string | null;
  mySide: number; mySlot: number; players: TbPlayer[]; games: TbGame[];
  gameStatus: string; endsAt: string; serverNow: string;
  myAnswered: number; myCorrect: number;
  question: { index: number; total: number; type: string; prompt: string; options: string[] } | null;
}

const rpc = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as any, args as any);
  if (error) throw error;
  return data as T;
};

export default function TeamBattle() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [state, setState] = useState<TbState | null>(null);
  const [busy, setBusy] = useState(false);
  const comboFx = useComboFx();
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string; picked: string } | null>(null);
  const [fillValue, setFillValue] = useState("");
  const [now, setNow] = useState(Date.now());
  const clockOffset = useRef(0);

  // find my active series on entry
  useEffect(() => {
    if (!profile) return;
    rpc<{ id: string | null }>("tb_my_series" as never).then((r: any) => {
      setSeriesId(r ?? null);
      setChecked(true);
    }).catch(() => setChecked(true));
  }, [profile]);

  const refresh = useCallback(async () => {
    if (!seriesId) return;
    try {
      const s = await rpc<TbState>("tb_state", { p_series: seriesId });
      if (!s.ok) { toast.error(s.error ?? "读取比赛失败"); return; }
      clockOffset.current = new Date(s.serverNow).getTime() - Date.now();
      setState(s);
    } catch { /* retry next tick */ }
  }, [seriesId]);

  useEffect(() => {
    if (!seriesId) return;
    refresh();
    const t = setInterval(refresh, 2000);
    const c = setInterval(() => setNow(Date.now()), 500);
    return () => { clearInterval(t); clearInterval(c); };
  }, [seriesId, refresh]);

  const answer = async (opt: string) => {
    if (!seriesId || !state?.question || busy || feedback) return;
    if (state.question.type === "fill" && !opt.trim()) return;
    setBusy(true);
    try {
      const r = await rpc<{ ok: boolean; error?: string; correct: boolean; answer: string }>("tb_answer",
        { p_series: seriesId, p_index: state.question.index, p_answer: opt });
      if (!r.ok) { toast.error(r.error ?? "提交失败"); await refresh(); return; }
      setFeedback({ correct: r.correct, answer: r.answer, picked: opt });
      comboFx.register(r.correct);
      setTimeout(async () => { setFeedback(null); setFillValue(""); await refresh(); }, 1200);
    } catch { toast.error("网络异常，请再点一次同一个答案"); } finally { setBusy(false); }
  };

  const left = state?.endsAt ? Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - now - clockOffset.current) / 1000)) : 0;
  const breakLeft = state?.breakEndsAt ? Math.max(0, Math.ceil((new Date(state.breakEndsAt).getTime() - now - clockOffset.current) / 1000)) : 0;
  const sideCorrect = (sd: number) => state?.players.filter(p => p.side === sd).reduce((a, p) => a + p.correct, 0) ?? 0;
  const winDots = (wins: number) => [0, 1].map(i => (
    <span key={i} className={`inline-block h-3 w-3 rounded-full ${i < wins ? "bg-gold" : "bg-muted"}`} />
  ));
  const inGame = state?.status === "active" && state?.gameStatus === "active";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" />回主页</Button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/team-battle/spectate")}>
              <Eye className="mr-1 h-4 w-4" />观赛
            </Button>
            <span className="text-xs font-semibold text-gold">TEAM BATTLE · BO3</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {!profile && (
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground">登录后才能参加比赛</p>
            <Button variant="hero" onClick={() => navigate("/auth")}>去登录</Button>
          </div>
        )}

        {profile && !checked && <Loader2 className="mx-auto h-10 w-10 animate-spin" />}

        {profile && checked && !seriesId && (
          <div className="space-y-4 py-16 text-center">
            <Swords className="mx-auto h-12 w-12 text-muted-foreground" />
            <h1 className="font-gaming text-3xl">2v2 战队赛</h1>
            <p className="text-sm text-muted-foreground">每人每局 50 题（选择 + 填空混合），三局两胜（BO3），局间有中场休息。全队答对总数高者赢下本局，打平比总用时。</p>
            <p className="text-sm text-muted-foreground">这是比赛专用模式，由管理员创建房间并统一开赛。</p>
            <p className="text-xs text-muted-foreground">你目前没有进行中的比赛。</p>
          </div>
        )}

        {profile && seriesId && !state && <Loader2 className="mx-auto h-10 w-10 animate-spin" />}

        {profile && seriesId && state && inGame && <><KillStreakBanner combo={comboFx.combo} /><SoundVariantSwitcher /></>}

        {profile && seriesId && state && (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border border-border bg-card p-4">
              {[0, 1].map(sd => (
                <div key={sd} className={`space-y-1 ${sd === 1 ? "order-3 text-right" : ""}`}>
                  <div className={`font-gaming text-lg ${sd === state.mySide ? "text-primary" : ""}`}>
                    {sd === 0 ? state.nameA : state.nameB}
                    {sd === state.mySide && <span className="ml-2 text-xs text-gold">我方</span>}
                  </div>
                  <div className={`flex gap-1 ${sd === 1 ? "justify-end" : ""}`}>{winDots(sd === 0 ? state.winsA : state.winsB)}</div>
                  <div className="text-3xl font-gaming">{sideCorrect(sd)}</div>
                  {state.players.filter(p => p.side === sd).map(p => (
                    <div key={p.slot} className={`text-xs ${p.side === state.mySide && p.slot === state.mySlot ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      {p.name} · 对 {p.correct} · {p.answered}/50
                    </div>
                  ))}
                </div>
              ))}
              <div className="order-2 text-center">
                <div className="text-xs text-muted-foreground">第 {state.currentGame} 局 · BO3</div>
                <div className="font-gaming text-xl">
                  {inGame ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "—"}
                </div>
                <div className="text-xs text-muted-foreground">{state.winsA} : {state.winsB}</div>
              </div>
            </div>

            {state.status === "lobby" && (
              <section className="space-y-4 border border-gold/40 bg-card p-8 text-center">
                <Swords className="mx-auto h-10 w-10 text-gold" />
                <h2 className="font-gaming text-2xl">等待开赛</h2>
                <p className="text-sm text-muted-foreground">你已进房间。管理员开赛后比赛自动开始，请保持本页打开。</p>
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              </section>
            )}

            {state.status === "halftime" && (
              <section className="space-y-4 border border-border bg-card p-8 text-center">
                <Pause className="mx-auto h-10 w-10 text-gold" />
                <h2 className="font-gaming text-2xl">中场休息</h2>
                <p className="font-gaming text-4xl">{Math.floor(breakLeft / 60)}:{String(breakLeft % 60).padStart(2, "0")}</p>
                <p className="text-sm text-muted-foreground">第 {state.currentGame} 局结束，休息结束后自动开始下一局。</p>
              </section>
            )}

            {inGame && state.question && state.question.type === "choice" && (
              <section className="space-y-4 border border-border bg-card p-6">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>第 {state.question.index + 1} / 50 题 · 选择</span>
                  <span>我已答对 {state.myCorrect}</span>
                </div>
                <h2 className="text-center font-gaming text-4xl" data-no-translate>{state.question.prompt}</h2>
                <div className="grid gap-3 sm:grid-cols-2" data-no-translate>
                  {state.question.options.map(o => {
                    const mark = feedback && (o === feedback.answer ? "border-success bg-success/20" : o === feedback.picked ? "border-destructive bg-destructive/20" : "");
                    return (
                      <Button key={o} variant="outline" className={`h-auto min-h-14 whitespace-normal py-3 ${mark || ""}`}
                        disabled={busy || !!feedback} onClick={() => answer(o)}>
                        {o}
                      </Button>
                    );
                  })}
                </div>
              </section>
            )}

            {inGame && state.question && state.question.type === "fill" && (
              <section className="space-y-4 border border-border bg-card p-6">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>第 {state.question.index + 1} / 50 题 · 填空</span>
                  <span>我已答对 {state.myCorrect}</span>
                </div>
                <h2 className="text-center font-gaming text-3xl" data-no-translate>{state.question.prompt}</h2>
                <p className="text-center text-xs text-muted-foreground">写出对应的英文单词</p>
                {feedback ? (
                  <p className={`text-center font-gaming text-2xl ${feedback.correct ? "text-success" : "text-destructive"}`} data-no-translate>
                    {feedback.correct ? "正确！" : `正确答案：${feedback.answer}`}
                  </p>
                ) : (
                  <form className="mx-auto flex max-w-sm gap-2" onSubmit={e => { e.preventDefault(); answer(fillValue); }}>
                    <Input value={fillValue} onChange={e => setFillValue(e.target.value)} placeholder="输入英文单词…"
                      autoFocus disabled={busy} className="text-center text-lg" autoCapitalize="off" autoCorrect="off" />
                    <Button type="submit" variant="hero" disabled={busy || !fillValue.trim()}>提交</Button>
                  </form>
                )}
              </section>
            )}

            {inGame && !state.question && (
              <p className="text-center text-muted-foreground">你已答完本局 50 题，等待其他选手…</p>
            )}

            {state.games.some(g => g.status === "finished") && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">局分记录</h3>
                <div className="grid gap-2">
                  {state.games.filter(g => g.status === "finished").map(g => (
                    <div key={g.gameNo} className="flex items-center justify-between border border-border bg-card px-4 py-2 text-sm">
                      <span>第 {g.gameNo} 局</span>
                      <span className="font-gaming">{g.scoreA} : {g.scoreB}</span>
                      <span className={g.winnerSide === state.mySide ? "text-success" : g.winnerSide === null ? "text-muted-foreground" : "text-destructive"}>
                        {g.winnerSide === null ? "平局" : g.winnerSide === state.mySide ? "我方胜" : "对方胜"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {state.status === "finished" && (
              <section className="space-y-4 border border-border bg-card p-8 text-center">
                {state.winnerSide === state.mySide
                  ? <Trophy className="mx-auto h-12 w-12 text-gold" />
                  : <Crown className="mx-auto h-12 w-12 text-muted-foreground" />}
                <h2 className="font-gaming text-4xl">
                  {state.winnerSide === null ? "系列赛平局" : state.winnerSide === state.mySide ? "赢下系列赛！" : "系列赛惜败"}
                </h2>
                <p className="font-gaming text-2xl">{state.nameA} {state.winsA} : {state.winsB} {state.nameB}</p>
                <p className="text-xs text-muted-foreground">比赛模式不影响段位，也不发放豆子奖励。</p>
                <Button variant="hero" onClick={() => navigate("/")}>回主页</Button>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
