import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Ghost, Loader2, Shield, Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useComboFx } from "@/hooks/useComboFx";
import KillStreakBanner from "@/components/battle/KillStreakBanner";
import SoundVariantSwitcher from "@/components/battle/SoundVariantSwitcher";

type Mode = "1v1" | "2v2";
interface HwPlayer { slot: number; team: number; name: string; isBot: boolean; score: number; answered: number; streak: number; shield: boolean; itemCount: number }
interface HwState {
  ok: boolean; error?: string; mode: Mode; status: string; endsAt: string; serverNow: string; winnerTeam: number | null;
  mySlot: number; myTeam: number; items: string[]; boosts: string[]; effects: string[]; reward: number | null; todayCoins: number;
  players: HwPlayer[];
  question: { index: number; total: number; prompt: string; options: string[]; removed: string[]; flags: string[] } | null;
}

export const HW_ITEMS: Record<string, { name: string; emoji: string; kind: string; desc: string }> = {
  curse: { name: "女巫诅咒", emoji: "🧙", kind: "进攻", desc: "对手下一次答对只得一半分" },
  steal: { name: "偷糖袋", emoji: "🍬", kind: "进攻", desc: "从对手那里偷走 5 分" },
  shield: { name: "南瓜护盾", emoji: "🛡️", kind: "防守", desc: "挡住下一次对你的攻击或捣蛋" },
  amulet: { name: "护身符", emoji: "🔮", kind: "防守", desc: "下一次答错不扣分" },
  fifty: { name: "猫头鹰之眼", emoji: "🦉", kind: "辅助", desc: "本题去掉两个错误选项" },
  double: { name: "满月之力", emoji: "🌕", kind: "辅助", desc: "下一次答对得分翻倍" },
  pumpkin: { name: "南瓜糊屏", emoji: "🎃", kind: "捣蛋", desc: "对手下一题屏幕被南瓜糊住" },
  ghost: { name: "幽灵捣乱", emoji: "👻", kind: "捣蛋", desc: "对手下一题选项不停换位置" },
};

const rpc = async <T,>(fn: string, args?: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn as any, args as any);
  if (error) throw error;
  return data as T;
};

export default function HalloweenBattle() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [phase, setPhase] = useState<"lobby" | "search" | "play">("lobby");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [waited, setWaited] = useState(0);
  const [state, setState] = useState<HwState | null>(null);
  const [busy, setBusy] = useState(false);
  const comboFx = useComboFx();
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string; picked: string } | null>(null);
  const [shuffleTick, setShuffleTick] = useState(0);
  const [now, setNow] = useState(Date.now());
  const clockOffset = useRef(0);

  // resume an unfinished game
  useEffect(() => {
    if (!profile) return;
    rpc<{ matchId: string | null; waited: number | null }>("hw_poll").then(r => {
      if (r.matchId) { setMatchId(r.matchId); setPhase("play"); }
      else if (r.waited !== null) setPhase("search");
    }).catch(() => {});
  }, [profile]);

  // matchmaking poll
  useEffect(() => {
    if (phase !== "search") return;
    const t = setInterval(async () => {
      try {
        const r = await rpc<{ matchId: string | null; waited: number | null }>("hw_poll");
        setWaited(r.waited ?? 0);
        if (r.matchId) { setMatchId(r.matchId); setPhase("play"); }
      } catch { /* keep polling */ }
    }, 2000);
    return () => clearInterval(t);
  }, [phase]);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    try {
      const s = await rpc<HwState>("hw_state", { p_match: matchId });
      if (!s.ok) { toast.error(s.error ?? "读取对局失败"); return; }
      clockOffset.current = new Date(s.serverNow).getTime() - Date.now();
      setState(s);
    } catch { /* retry next tick */ }
  }, [matchId]);

  useEffect(() => {
    if (phase !== "play" || !matchId) return;
    refresh();
    const t = setInterval(refresh, 1500);
    const c = setInterval(() => setNow(Date.now()), 500);
    return () => { clearInterval(t); clearInterval(c); };
  }, [phase, matchId, refresh]);

  const ghost = !!state?.question?.flags.includes("ghost");
  useEffect(() => {
    if (!ghost) return;
    const t = setInterval(() => setShuffleTick(x => x + 1), 1200);
    return () => clearInterval(t);
  }, [ghost]);

  const options = useMemo(() => {
    const o = state?.question?.options ?? [];
    if (!ghost) return o;
    const r = [...o]; const k = shuffleTick % Math.max(1, r.length);
    return [...r.slice(k), ...r.slice(0, k)];
  }, [state?.question, ghost, shuffleTick]);

  const join = async (mode: Mode) => {
    setBusy(true);
    try {
      const r = await rpc<{ ok: boolean; error?: string; matchId: string | null }>("hw_join", { p_mode: mode });
      if (!r.ok) { toast.error(r.error ?? "无法开始匹配"); return; }
      setWaited(0);
      if (r.matchId) { setMatchId(r.matchId); setPhase("play"); } else setPhase("search");
    } catch { toast.error("网络异常，请重试"); } finally { setBusy(false); }
  };

  const cancel = async () => {
    try {
      const r = await rpc<{ matchId: string | null }>("hw_cancel");
      if (r.matchId) { setMatchId(r.matchId); setPhase("play"); } else setPhase("lobby");
    } catch { toast.error("取消失败，请重试"); }
  };

  const answer = async (opt: string) => {
    if (!matchId || !state?.question || busy || feedback) return;
    setBusy(true);
    try {
      const r = await rpc<{ ok: boolean; error?: string; correct: boolean; answer: string; drop?: string }>("hw_answer",
        { p_match: matchId, p_index: state.question.index, p_answer: opt });
      if (!r.ok) { toast.error(r.error ?? "提交失败"); await refresh(); return; }
      setFeedback({ correct: r.correct, answer: r.answer, picked: opt });
      comboFx.register(r.correct);
      if (r.drop) toast.success(`连对掉落道具：${HW_ITEMS[r.drop]?.emoji} ${HW_ITEMS[r.drop]?.name}`);
      setTimeout(async () => { setFeedback(null); await refresh(); }, 900);
    } catch { toast.error("网络异常，请再点一次同一个答案"); } finally { setBusy(false); }
  };

  const applyItem = async (item: string, target = -1) => {
    if (!matchId) return;
    try {
      const r = await rpc<{ ok: boolean; error?: string; message?: string }>("hw_use_item", { p_match: matchId, p_item: item, p_target: target });
      if (r.ok) toast.success(`${HW_ITEMS[item]?.emoji} ${r.message}`); else toast.error(r.error ?? "使用失败");
      await refresh();
    } catch { toast.error("网络异常，请重试"); }
  };

  const left = state ? Math.max(0, Math.ceil((new Date(state.endsAt).getTime() - now - clockOffset.current) / 1000)) : 0;
  const teamScore = (t: number) => state?.players.filter(p => p.team === t).reduce((a, p) => a + p.score, 0) ?? 0;
  const opponents = state?.players.filter(p => p.team !== state.myTeam) ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/entertainment")}><ArrowLeft className="mr-2 h-4 w-4" />娱乐模式</Button>
          <span className="text-xs font-semibold text-gold">HALLOWEEN · 10.22–11.22</span>
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {!profile && (
          <div className="space-y-4 text-center">
            <p className="text-muted-foreground">登录后才能参加道具赛</p>
            <Button variant="hero" onClick={() => navigate("/auth")}>去登录</Button>
          </div>
        )}

        {profile && phase === "lobby" && (
          <>
            <div className="space-y-2">
              <h1 className="font-gaming text-4xl">🎃 万圣节道具赛</h1>
              <p className="text-sm text-muted-foreground">每人 30 题，8 分钟。答对 +10，答错 −2。开局送 1 个道具，连对 3 题再掉 1 个（最多拿 3 个）。不影响段位。</p>
              <p className="text-sm">赢 <b className="text-gold">50</b> 豆 · 平 <b>25</b> 豆 · 输 <b>15</b> 豆，每天最多 250 豆。60 秒没匹配到真人会自动补人机。</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Button variant="hero" size="lg" className="h-24 text-xl" disabled={busy} onClick={() => join("1v1")}><Swords className="mr-2 h-6 w-6" />1v1 单挑</Button>
              <Button variant="gold" size="lg" className="h-24 text-xl" disabled={busy} onClick={() => join("2v2")}><Users className="mr-2 h-6 w-6" />2v2 组队</Button>
            </div>
            <section className="grid gap-3 sm:grid-cols-2">
              {Object.entries(HW_ITEMS).map(([k, it]) => (
                <div key={k} className="flex items-start gap-3 border border-border bg-card p-3">
                  <span className="text-2xl">{it.emoji}</span>
                  <div><div className="font-semibold">{it.name} <span className="text-xs text-primary">{it.kind}</span></div>
                    <div className="text-xs text-muted-foreground">{it.desc}</div></div>
                </div>
              ))}
            </section>
          </>
        )}

        {profile && phase === "search" && (
          <div className="space-y-4 py-16 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p>正在寻找对手… {waited} 秒</p>
            <p className="text-xs text-muted-foreground">满 60 秒会自动补人机</p>
            <Button variant="outline" onClick={cancel}>取消匹配</Button>
          </div>
        )}

        {profile && phase === "play" && !state && <Loader2 className="mx-auto h-10 w-10 animate-spin" />}

        {profile && phase === "play" && state && state.status === "active" && <><KillStreakBanner combo={comboFx.combo} /><SoundVariantSwitcher /></>}
        {profile && phase === "play" && state && (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 border border-border bg-card p-4">
              {[0, 1].map(t => (
                <div key={t} className={`space-y-1 ${t === 1 ? "order-3 text-right" : ""}`}>
                  <div className="text-3xl font-gaming">{teamScore(t)}</div>
                  {state.players.filter(p => p.team === t).map(p => (
                    <div key={p.slot} className={`text-xs ${p.slot === state.mySlot ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                      {p.shield && <Shield className="mr-1 inline h-3 w-3" />}{p.name} · {p.score} 分 · {p.answered}/30
                    </div>
                  ))}
                </div>
              ))}
              <div className="order-2 text-center">
                <div className="text-xs text-muted-foreground">{state.myTeam === 0 ? "我方 ←" : "→ 我方"}</div>
                <div className="font-gaming text-xl">{state.status === "active" ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "结束"}</div>
              </div>
            </div>

            {state.status === "active" && state.question && (
              <section className="relative space-y-4 border border-border bg-card p-6">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>第 {state.question.index + 1} / 30 题</span>
                  <span>{state.boosts.map(b => HW_ITEMS[b]?.emoji).join(" ")} {state.effects.includes("curse") && "🧙 被诅咒中"}</span>
                </div>
                <h2 className="text-center font-gaming text-4xl" data-no-translate>{state.question.prompt}</h2>
                <div className="grid gap-3 sm:grid-cols-2" data-no-translate>
                  {options.map(o => {
                    const removed = state.question?.removed.includes(o);
                    const mark = feedback && (o === feedback.answer ? "border-success bg-success/20" : o === feedback.picked ? "border-destructive bg-destructive/20" : "");
                    return (
                      <Button key={o} variant="outline" className={`h-auto min-h-14 whitespace-normal py-3 ${mark || ""}`}
                        disabled={removed || busy || !!feedback} onClick={() => answer(o)}>
                        {removed ? "🦉 已排除" : o}
                      </Button>
                    );
                  })}
                </div>
                {state.question.flags.includes("pumpkin") && !feedback && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gold/30 backdrop-blur-[3px]">
                    <span className="animate-pulse text-7xl">🎃</span>
                  </div>
                )}
              </section>
            )}

            {state.status === "active" && !state.question && (
              <p className="text-center text-muted-foreground">你已答完 30 题，等待其他玩家…</p>
            )}

            {state.status === "active" && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">我的道具（{state.items.length}/3）</h3>
                <div className="flex flex-wrap gap-2">
                  {state.items.length === 0 && <span className="text-xs text-muted-foreground">连对 3 题会掉落道具</span>}
                  {state.items.map((it, i) => {
                    const info = HW_ITEMS[it];
                    const attack = info?.kind === "进攻" || info?.kind === "捣蛋";
                    return attack && opponents.length > 1 ? (
                      <div key={i} className="flex items-center gap-1 border border-border p-1">
                        <span className="px-1">{info.emoji} {info.name} →</span>
                        {opponents.map(o => <Button key={o.slot} size="sm" variant="outline" onClick={() => applyItem(it, o.slot)}>{o.name}</Button>)}
                      </div>
                    ) : (
                      <Button key={i} variant="outline" title={info?.desc} onClick={() => applyItem(it, opponents[0]?.slot ?? -1)}>{info?.emoji} {info?.name}</Button>
                    );
                  })}
                </div>
              </section>
            )}

            {state.status !== "active" && (
              <section className="space-y-4 border border-border bg-card p-8 text-center">
                <Ghost className="mx-auto h-12 w-12 text-gold" />
                <h2 className="font-gaming text-4xl">
                  {state.winnerTeam === null ? "平局" : state.winnerTeam === state.myTeam ? "胜利！" : "惜败"}
                </h2>
                <p>获得狄邦豆 <b className="text-gold">+{state.reward ?? 0}</b>（今日 {state.todayCoins}/250）</p>
                {state.reward === 0 && <p className="text-xs text-muted-foreground">没有答题或今天已达上限，本局不发豆</p>}
                <div className="flex justify-center gap-3">
                  <Button variant="hero" onClick={() => { comboFx.reset(); setState(null); setMatchId(null); setPhase("lobby"); }}>再来一局</Button>
                  <Button variant="outline" onClick={() => navigate("/")}>回主页</Button>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
