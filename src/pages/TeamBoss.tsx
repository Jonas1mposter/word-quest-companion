import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Swords, Shield, Heart, Crown, Users, Loader2, RotateCcw, Check, Timer, Coins, Zap, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useLobbyParty } from "@/hooks/useLobbyParty";
import { BOSS_ROLES, bossAction, canStartBoss, type BossRequest, type BossResult, type BossRole } from "@/lib/teamBoss";
import { useComboFx } from "@/hooks/useComboFx";
import KillStreakBanner from "@/components/battle/KillStreakBanner";
import SoundVariantSwitcher from "@/components/battle/SoundVariantSwitcher";
import art from "@/assets/team-boss.jpg";

const icons = { damage: Swords, guardian: Shield, healer: Heart };
export default function TeamBoss() {
  const navigate = useNavigate();
  const { profile, loading, refreshProfile } = useAuth();
  const { party } = useLobbyParty(profile);
  const [result, setResult] = useState<BossResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<BossRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [target, setTarget] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const comboFx = useComboFx(); const registerCombo = comboFx.register;
  const lock = useRef(false); const active = useRef(true); const offset = useRef(0);
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const state = result?.state; const me = state?.players.find(p => p.id === profile?.id);
  const finished = !!state && !["lobby", "combat"].includes(state.phase);
  const execute = useCallback(async (request: BossRequest, poll = false) => {
    if (lock.current || (poll && pendingRef.current)) return;
    lock.current = true; if (!poll) setBusy(true);
    try {
      const next = await bossAction(request);
      if (!active.current) return;
      setResult(next); setError(null); setPending(null);
      if (request.action === "answer" && typeof next.state?.question?.correct === "boolean") registerCombo(next.state.question.correct);
      if (next.state) {
        offset.current = Date.parse(next.state.serverNow) - Date.now();
        if (!["lobby", "combat"].includes(next.state.phase)) void refreshProfile();
      }
    } catch (e) {
      if (active.current) {
        setError(e instanceof Error ? e.message : "请求未能确认，请重试");
        if (!poll) setPending(request);
      }
    } finally { lock.current = false; if (active.current) setBusy(false); }
  }, [refreshProfile, registerCombo]);
  const execRef = useRef(execute); execRef.current = execute;
  const stateRef = useRef(state); stateRef.current = state;
  const joinedRef = useRef(!!me); joinedRef.current = !!me;
  useEffect(() => {
    active.current = true;
    if (profile?.id) void execRef.current({ action: "resume" });
    const timer = setInterval(() => {
      if (!profile?.id) return;
      const s = stateRef.current;
      if (s && !["lobby", "combat"].includes(s.phase)) return;
      void execRef.current(s && joinedRef.current ? { action: "state", run: s.id } : { action: "resume" }, true);
    }, 3000);
    return () => { active.current = false; clearInterval(timer); };
  }, [profile?.id]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => { setAnswer(""); setTarget(null); }, [state?.id, state?.round]);
  const send = (action: string, choice?: string, selected?: string) => {
    if (state && !pending) void execute({ action, run: state.id, round: state.round || undefined, choice, target: selected });
  };
  const remaining = state ? Math.max(0, Math.ceil((Date.parse(state.deadline) - now - offset.current) / 1000)) : 0;
  const disabled = busy || !!pending;
  const q = state?.question;
  return <div className="min-h-screen bg-background bg-grid-pattern">
    {state?.phase === "combat" && <><KillStreakBanner combo={comboFx.combo} /><SoundVariantSwitcher /></>}
    <header className="border-b border-border"><div className="mx-auto max-w-5xl px-4 py-3 flex justify-between gap-3">
      <Button variant="ghost" onClick={() => navigate("/entertainment")}><ArrowLeft className="h-4 w-4" />娱乐模式</Button>
      {state?.phase === "lobby" && me && <Button variant="ghost" disabled={disabled} onClick={() => send("leave")}><LogOut className="h-4 w-4" />离开房间</Button>}
    </div></header>
    {!state ? <>
      <section className="relative min-h-[460px] overflow-hidden">
        <img src={art} alt="五名冒险者挑战晶角巨兽" width={1536} height={864} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 py-10 min-h-[460px] flex flex-col justify-end items-start gap-4">
          <span className="text-gold font-bold">晶角圣殿 · 战队合作</span><h1 className="font-gaming text-5xl font-bold">战队 Boss</h1>
          <div className="flex flex-wrap gap-5 text-sm"><span>3—5 人</span><span>10 分钟</span><span>不计段位</span></div>
          <Button variant="gold" size="lg" disabled={loading || busy || !!pending || !!party || (!!profile && !result)} onClick={() => !profile ? navigate("/auth") : result?.team ? void execute({ action: "create" }) : navigate("/?view=team")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}{!profile ? "登录参与" : result?.team ? "创建挑战房间" : "前往战队"}
          </Button>
          {result?.team && <span className="text-sm">{result.team.name}</span>}
          {party && <span className="text-sm text-muted-foreground">组队中不可选择</span>}
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 py-6 border-t border-border flex flex-wrap gap-5 text-sm text-muted-foreground"><span className="text-gold">胜利 +60 豆</span><span>失败 +10 豆</span><span>每日上限 180 豆</span><span>本人 ≥5 题且答对 ≥3 题 · 对局 ≥60 秒</span></section>
    </> : <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><span className="text-xs text-gold">{result?.team?.name}</span><h1 className="font-gaming text-3xl font-bold">战队 Boss</h1></div><span className="text-gold font-mono flex items-center gap-2"><Timer className="h-4 w-4" />{state.phase === "combat" ? `回合 ${state.round} · ` : ""}{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span></div>
      {state.phase === "combat" && <section className="relative h-64 overflow-hidden border border-border">
        <img src={art} alt="晶角巨兽" width={1536} height={864} className="h-full w-full object-cover object-right" />
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" /><div className="absolute inset-x-0 bottom-0 p-4 space-y-3">
          <div className="flex justify-between gap-3"><h2 className="font-bold text-xl">晶角巨兽</h2><span>{state.bossHp} / {state.bossMax}</span></div><Progress value={state.bossHp / state.bossMax * 100} />
          {state.charging ? <span className="text-gold flex gap-2 items-center text-sm"><Zap className="h-4 w-4" />蓄力 · 本轮答对 {state.required} 人打断</span> : state.bossHp <= state.bossMax * .3 ? <span className="text-destructive text-sm">最终阶段 · 狂暴</span> : null}
        </div>
      </section>}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-label="战队成员">{state.players.map(p => { const Icon = icons[p.role]; return <article key={p.id} className={`min-w-0 border p-3 space-y-3 ${p.id === profile?.id ? "border-gold bg-card" : "border-border bg-card"}`}>
        <div className="flex gap-2 items-center min-w-0"><Icon className="h-4 w-4 shrink-0 text-gold" /><span className="font-bold text-sm break-all">{p.name}</span></div>
        <div className="text-xs text-muted-foreground">{BOSS_ROLES[p.role].name}{p.id === state.host ? " · 房主" : ""}</div>
        {state.phase === "lobby" ? <span className={`text-xs ${p.ready ? "text-success" : "text-muted-foreground"}`}>{p.ready ? "已准备" : "未准备"}</span> : <><div className="flex justify-between text-xs"><span>{p.hp === 0 ? "倒地" : "生命"}</span><span>{p.hp}/100</span></div><Progress value={p.hp} className="h-1.5" /><span className="text-xs text-muted-foreground">{p.acted ? "行动已确认" : p.submitted ? "已答题" : p.hp === 0 ? "等待救援" : "答题中"}</span></>}
      </article>; })}</section>
      {state.phase === "lobby" ? <section className="border-t border-border py-6 space-y-5">
        <div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold text-xl">挑战房间</h2><span className="text-muted-foreground">{state.players.length} / 5 人</span></div>
        {me ? <><div className="grid sm:grid-cols-3 gap-3">{(Object.keys(BOSS_ROLES) as BossRole[]).map(role => { const Icon = icons[role]; return <Button key={role} variant={me.role === role ? "gold" : "outline"} className="h-auto min-h-24 flex-col gap-2 whitespace-normal" disabled={disabled} onClick={() => send("role", role)}><Icon className="h-5 w-5" />{BOSS_ROLES[role].name}<span className="text-xs">{BOSS_ROLES[role].detail}</span></Button>; })}</div>
          <div className="flex flex-wrap gap-3"><Button variant={me.ready ? "outline" : "hero"} disabled={disabled} onClick={() => send("ready", me.ready ? "false" : "true")}><Check className="h-4 w-4" />{me.ready ? "取消准备" : "准备"}</Button>
          {state.host === profile?.id && <Button variant="gold" disabled={disabled || !canStartBoss(state, profile.id)} onClick={() => send("start")}><Swords className="h-4 w-4" />开始挑战</Button>}</div>
        </> : <Button variant="gold" disabled={disabled || !!party || state.players.length >= 5} onClick={() => void execute({ action: "join" })}><Users className="h-4 w-4" />加入挑战</Button>}
      </section> : finished ? <section className="text-center border-y border-border py-10 space-y-5"><Crown className="h-14 w-14 mx-auto text-gold" /><h2 className="font-gaming text-3xl font-bold">{state.phase === "won" ? "挑战成功" : state.phase === "lost" ? "挑战结束" : "房间已关闭"}</h2><div className="text-xl text-gold flex gap-2 justify-center items-center"><Coins className="h-5 w-5" />+{me?.coins ?? 0} 狄邦豆</div><div className="text-sm text-muted-foreground">今日 {state.dailyCoins} / {state.dailyCap} 豆</div><Button variant="gold" disabled={disabled || !!party} onClick={() => void execute({ action: "create" })}><RotateCcw className="h-4 w-4" />再来一局</Button></section> : me?.hp === 0 ? <section className="py-8 text-center border-y border-border space-y-3"><Heart className="h-10 w-10 mx-auto text-destructive" /><h2 className="text-xl font-bold">等待队友治疗</h2></section> : q ? <section className="border-t border-border py-6 space-y-5">
        {!q.submitted ? <><div className="text-center space-y-3"><span className="text-xs text-muted-foreground">{q.kind === "spelling" ? "根据释义拼写" : "选择释义"}</span><h2 data-no-translate className="font-gaming text-3xl break-words">{q.prompt}</h2></div>
          {q.kind === "choice" ? <div data-no-translate className="grid sm:grid-cols-2 gap-3">{q.options.map((option, i) => <Button key={option} variant="outline" disabled={disabled} className="min-h-20 h-auto whitespace-normal text-left justify-start gap-3 p-4 bg-card" onClick={() => send("answer", option)}><span className="font-mono text-gold">{"ABCD"[i]}</span>{option}</Button>)}</div> : <form className="mx-auto max-w-lg flex gap-3" onSubmit={e => { e.preventDefault(); if (answer.trim() && !disabled) send("answer", answer); }}><Input aria-label="拼写答案" value={answer} onChange={e => setAnswer(e.target.value)} autoComplete="off" spellCheck={false} disabled={disabled} /><Button variant="gold" type="submit" disabled={disabled || !answer.trim()}><Check className="h-4 w-4" />提交</Button></form>}
        </> : <><div className="text-center space-y-2"><h2 className={`text-xl font-bold ${q.correct ? "text-success" : "text-destructive"}`}>{q.correct ? "回答正确" : "回答错误"}</h2>{q.feedback && <div data-no-translate><span className="text-2xl font-gaming">{q.feedback.word}</span><div className="text-muted-foreground">{q.feedback.meaning}</div></div>}</div>
          {q.correct && !q.acted ? <><h3 className="font-bold">选择行动</h3><div className="flex flex-wrap gap-2" aria-label="行动目标">{state.players.map(p => <Button key={p.id} variant={target === p.id ? "gold" : "outline"} disabled={disabled} onClick={() => setTarget(p.id)}><Heart className="h-4 w-4" />{p.name} · {p.hp}</Button>)}</div><div className="grid grid-cols-3 gap-3"><Button variant="hero" disabled={disabled} onClick={() => send("act", "attack")}><Swords className="h-4 w-4" />攻击</Button><Button variant="outline" disabled={disabled || !target} onClick={() => target && send("act", "guard", target)}><Shield className="h-4 w-4" />守护</Button><Button variant="gold" disabled={disabled || !target} onClick={() => target && send("act", "heal", target)}><Heart className="h-4 w-4" />治疗</Button></div></> : <div className="text-center text-muted-foreground text-sm">等待队友行动</div>}
        </>}
      </section> : null}
      {state.log.round && <section className="border-t border-border pt-4 text-sm text-muted-foreground flex flex-wrap gap-4" aria-live="polite"><span>上一轮伤害 {state.log.damage}</span><span>答对 {state.log.correct} 人</span><span>{state.log.interrupted ? "蓄力已打断" : `受到 ${state.log.incoming} 伤害`}</span></section>}
    </main>}
    {error && <div className="mx-auto max-w-5xl px-4 py-5 flex flex-wrap gap-3 items-center" role="alert"><span className="text-destructive text-sm">{error}</span><Button variant="outline" disabled={busy} onClick={() => void execute(pending ?? (state && me ? { action: "state", run: state.id } : { action: "resume" }))}><RotateCcw className="h-4 w-4" />{pending?.action === "answer" ? "重试原答案" : "重试"}</Button></div>}
  </div>;
}