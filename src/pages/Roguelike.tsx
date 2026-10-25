import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Swords, Shield, Heart, Flame, Sparkles, Crown, Volume2, Loader2, RotateCcw, ArrowRight, Coins, Flag, Timer, Check, X, Tent, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useLobbyParty } from "@/hooks/useLobbyParty";
import { supabase } from "@/integrations/supabase/client";
import { audioManager } from "@/lib/audioManager";
import { boundedRequest } from "@/lib/boundedRequest";
import { ROGUE_NODES, ROGUE_SKILLS, rogueAction, type RogueState, type RogueFeedback, type RogueAction, type RogueNode, type RogueSkill } from "@/lib/roguelike";
import { useComboFx } from "@/hooks/useComboFx";
import KillStreakBanner from "@/components/battle/KillStreakBanner";
import SoundVariantSwitcher from "@/components/battle/SoundVariantSwitcher";
import forest from "@/assets/roguelike-forest.jpg";

const nodeIcons = { battle: Swords, elite: Skull, rest: Tent, event: Sparkles, boss: Crown };
const skillIcons = { combo: Flame, ward: Shield, healing: Heart, power: Swords, armor: Shield, echo: Volume2 };

export default function Roguelike() {
  const navigate = useNavigate();
  const { profile, loading, refreshProfile } = useAuth();
  const { party } = useLobbyParty(profile);
  const [state, setState] = useState<RogueState | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<RogueAction | null>(null);
  const [feedback, setFeedback] = useState<RogueFeedback | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const [exit, setExit] = useState(false);
  const [now, setNow] = useState(Date.now());
  const offset = useRef(0);
  const active = useRef(true);
  const requestBusy = useRef(false);
  const audioSource = useRef<AudioBufferSourceNode | null>(null);
  const comboFx = useComboFx();
  const registerCombo = comboFx.register;
  const execute = useCallback(async (request: RogueAction) => {
    if (requestBusy.current) return;
    requestBusy.current = true; setBusy(true); setError(null);
    try {
      const result = await rogueAction(request);
      if (!active.current) return;
      setState(result.state); setFeedback(result.feedback ?? null); setPending(null);
      if (request.action === "start") comboFx.reset();
      if (result.feedback) registerCombo(result.feedback.correct);
      if (result.state) offset.current = Date.parse(result.state.serverNow) - Date.now();
      if (result.state && ["won", "lost", "abandoned"].includes(result.state.phase)) void refreshProfile();
      setReady(true);
    } catch (e) {
      if (active.current) { setError(e instanceof Error ? e.message : "请求未能确认，请重试"); setPending(request); }
    } finally { requestBusy.current = false; if (active.current) setBusy(false); }
  }, [refreshProfile, registerCombo, comboFx.reset]);
  const executeRef = useRef(execute); executeRef.current = execute;
  useEffect(() => {
    active.current = true;
    if (profile?.id) void executeRef.current({ action: "resume" });
    return () => { active.current = false; audioSource.current?.stop(); };
  }, [profile?.id]);
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => { setAudioError(false); setPlaying(false); audioSource.current?.stop(); audioSource.current = null; }, [state?.question?.index]);
  const finished = !!state && ["won", "lost", "abandoned"].includes(state.phase);
  const remaining = state ? Math.max(0, Math.ceil((Date.parse(state.endsAt) - now - offset.current) / 1000)) : 480;
  useEffect(() => {
    if (state && !finished && remaining === 0 && !busy && !pending && !feedback) void executeRef.current({ action: "state", run: state.id });
  }, [remaining, finished, busy, pending, feedback, state?.id]);
  const send = (action: string, choice?: string, index?: number) => {
    if (state && !pending) void execute({ action, run: state.id, version: state.version, choice, index });
  };
  const playAudio = async () => {
    if (!state?.question || playing) return;
    setPlaying(true); setAudioError(false);
    try {
      const context = await audioManager.ensureReady();
      const { data, error: requestError } = await boundedRequest(supabase.functions.invoke("rogue-audio", { body: { runId: state.id, index: state.question.index } }), 15000);
      if (requestError || !(data instanceof Blob) || !data.size) throw new Error("audio");
      const buffer = await context.decodeAudioData(await data.arrayBuffer());
      audioSource.current?.stop();
      const source = context.createBufferSource(); source.buffer = buffer; source.connect(context.destination);
      audioSource.current = source; source.onended = () => { if (active.current) setPlaying(false); }; source.start();
    } catch { setAudioError(true); setPlaying(false); }
  };
  const hasRun = state && !finished;
  return <div className="min-h-screen bg-background bg-grid-pattern">
    <header className="border-b border-border"><div className="mx-auto max-w-5xl px-4 py-3 flex justify-between items-center gap-3">
      <Button variant="ghost" onClick={() => navigate("/entertainment")}><ArrowLeft className="h-4 w-4" />娱乐模式</Button>
      {hasRun && <Button variant="ghost" size="icon" aria-label="放弃冒险" title="放弃冒险" onClick={() => setExit(true)} disabled={busy || !!pending}><Flag className="h-4 w-4" /></Button>}
    </div></header>
    {!state ? <>
      <section className="relative min-h-[440px] sm:min-h-[500px] overflow-hidden">
        <img src={forest} alt="词汇冒险与古树守护者" width={1536} height={864} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 py-10 flex min-h-[440px] sm:min-h-[500px] flex-col items-start justify-end gap-4">
          <span className="font-bold text-gold">遗迹之森 · 单人冒险</span><h1 className="font-gaming text-5xl font-bold">词汇肉鸽</h1>
          <div className="flex flex-wrap gap-5 text-sm"><span className="flex items-center gap-2"><Timer className="h-4 w-4" />8 分钟</span><span className="flex items-center gap-2"><Crown className="h-4 w-4" />5 层挑战</span><span className="flex items-center gap-2"><Shield className="h-4 w-4" />不计段位</span></div>
          <Button variant="gold" size="lg" disabled={loading || busy || !!pending || (!!profile && !ready) || !!party} onClick={() => profile ? void execute({ action: "start" }) : navigate("/auth")}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}{profile ? "开始冒险" : "登录参与"}<ArrowRight className="h-4 w-4" />
          </Button>
          {party && <span className="text-sm text-muted-foreground">组队中不可选择</span>}
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-4 py-6 border-t border-border"><div className="flex flex-wrap gap-4 text-sm text-muted-foreground"><span className="text-gold">通关 +30 豆</span><span>每个精英 +5 豆</span><span>失败 ≥10 题 +5 豆</span><span>每日上限 120 豆</span></div></section>
    </> : <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {!finished && <><KillStreakBanner combo={comboFx.combo} /><SoundVariantSwitcher /></>}
      <div className="flex flex-wrap justify-between items-center gap-3"><h1 className="font-gaming text-2xl font-bold">词汇肉鸽</h1><span className="font-mono flex gap-2 items-center text-gold"><Timer className="h-4 w-4" />{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}</span></div>
      <div className="flex items-center gap-2" aria-label="冒险进度">{Array.from({ length: 5 }, (_, i) => <div key={i} className={`flex-1 border-b-2 pb-2 text-center text-xs ${i + 1 <= state.floor ? "border-gold text-gold" : "border-border text-muted-foreground"}`}>{i === 4 ? "守护者" : `第 ${i + 1} 层`}</div>)}</div>
      <div className="grid grid-cols-2 gap-6"><div><div className="flex justify-between items-center text-sm mb-2"><span className="flex items-center gap-2"><Heart className="h-4 w-4 text-destructive" />生命</span><span>{state.hp} / {state.maxHp}</span></div><Progress value={state.hp / state.maxHp * 100} className="h-2" /></div><div className="flex items-center justify-end gap-5 text-sm"><span className="text-gold">连击 {state.streak}</span><span className="text-muted-foreground">{state.correct} / {state.answered} 答对</span></div></div>
      {finished && !feedback ? <section className="py-12 text-center space-y-5 border-y border-border">
        {state.phase === "won" ? <Crown className="mx-auto h-16 w-16 text-gold" /> : <BookOpen className="mx-auto h-16 w-16 text-muted-foreground" />}
        <h2 className="font-gaming text-4xl font-bold">{state.phase === "won" ? "遗迹通关" : state.phase === "abandoned" ? "冒险已结束" : "冒险未竟"}</h2>
        <div className="flex items-center justify-center gap-2 text-gold text-xl"><Coins className="h-5 w-5" />+{state.coins} 狄邦豆</div>
        <p className="text-sm text-muted-foreground">今日 {state.dailyCoins} / {state.dailyCap} 豆</p>
        <Button variant="gold" size="lg" disabled={busy || !!pending || !!party} onClick={() => void execute({ action: "start" })}><RotateCcw className="h-4 w-4" />再来一局</Button>
      </section> : feedback ? <section className="py-12 space-y-5 text-center border-y border-border" aria-live="polite">
        {feedback.correct ? <Check className="mx-auto h-12 w-12 text-success" /> : <X className="mx-auto h-12 w-12 text-destructive" />}
        <h2 className="text-2xl font-bold">{feedback.correct ? "回答正确" : "回答错误"}</h2>
        <div data-no-translate className="space-y-2"><div className="text-3xl font-gaming">{feedback.word}</div><div className="text-lg text-muted-foreground">{feedback.answer}</div></div>
        <div className="text-gold">{feedback.correct ? `造成 ${feedback.damage} 伤害${feedback.healing ? ` · 恢复 ${feedback.healing} 生命` : ""}` : "连击已重置"}</div>
        <Button variant="gold" onClick={() => setFeedback(null)}><ArrowRight className="h-4 w-4" />继续</Button>
      </section> : state.phase === "route" ? <section className="space-y-5 py-5">
        <h2 className="font-gaming text-2xl font-bold">选择路线</h2>
        {state.event && <div className="border-l-2 border-success pl-4 py-2 text-success">{state.event === "rest" ? "篝火休憩 · 生命 +22" : state.event === "spring" ? "林间泉水 · 生命 +16" : "古代遗物 · 生命上限 +12，生命 +6"}</div>}
        <div className="grid gap-4 sm:grid-cols-3">{state.routes.map((node: RogueNode) => { const Icon = nodeIcons[node]; return <Button key={node} variant="outline" className="h-auto min-h-48 whitespace-normal flex-col gap-4 border-border bg-card p-5" disabled={busy || !!pending} onClick={() => send("route", node)}><Icon className="!h-9 !w-9 text-gold" /><span className="font-gaming text-xl font-bold">{ROGUE_NODES[node].name}</span><span className="text-xs text-muted-foreground">{ROGUE_NODES[node].detail}</span><ArrowRight className="h-4 w-4" /></Button>; })}</div>
      </section> : state.phase === "skill" ? <section className="space-y-5 py-5"><div className="flex items-center gap-3"><Sparkles className="text-gold h-6 w-6" /><h2 className="font-gaming text-2xl font-bold">选择技能</h2>{state.node === "elite" && <span className="text-gold">精英奖励 +2 级</span>}</div>
        <div className="grid gap-4 sm:grid-cols-3">{state.offers.map((skill: RogueSkill) => { const Icon = skillIcons[skill]; return <Button key={skill} variant="outline" className="h-auto min-h-56 whitespace-normal flex-col gap-3 bg-card p-5" disabled={busy || !!pending} onClick={() => send("skill", skill)}><span className="text-xs text-gold">{ROGUE_SKILLS[skill].family}</span><Icon className="!h-8 !w-8 text-primary" /><span className="font-bold text-xl">{ROGUE_SKILLS[skill].name}</span><span className="text-xs text-muted-foreground">{ROGUE_SKILLS[skill].detail}</span></Button>; })}</div>
      </section> : state.phase === "combat" && state.question ? <section className="space-y-6">
        <div className="relative overflow-hidden h-48 sm:h-56 border border-border"><img src={forest} loading="lazy" width={1536} height={864} alt={ROGUE_NODES[state.node]?.enemy ?? "守护者"} className="absolute inset-0 h-full w-full object-cover object-right" /><div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-4"><div className="flex justify-between items-center mb-2"><h2 className="font-gaming text-xl font-bold">{ROGUE_NODES[state.node]?.enemy}</h2><span className="text-sm">{state.enemyHp} / {state.enemyMax}</span></div><Progress value={state.enemyHp / state.enemyMax * 100} className="h-2" />{state.node === "boss" && state.enemyHp <= state.enemyMax / 2 && <span className="mt-2 block text-xs text-destructive">守护者狂暴 · 答错伤害 18</span>}</div></div>
        <div className="py-4 text-center space-y-4"><span className="text-xs text-muted-foreground">{state.question.kind === "listening" ? "听音选义" : "选择释义"}</span>
          {state.question.kind === "listening" ? <Button variant="outline" size="lg" onClick={() => void playAudio()} disabled={playing}>{playing ? <Loader2 className="animate-spin h-5 w-5" /> : <Volume2 className="h-5 w-5" />}{audioError ? "发音加载失败，请点击重试" : "播放发音"}</Button> : <h3 data-no-translate className="font-gaming text-4xl break-words">{state.question.prompt}</h3>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3" data-no-translate>{state.question.options.map((option, index) => <Button variant="outline" key={option} disabled={busy || !!pending} className="min-h-20 h-auto whitespace-normal text-base justify-start text-left gap-4 p-4 bg-card" onClick={() => send("answer", option, state.question?.index)}><span className="text-gold shrink-0 font-mono">{"ABCD"[index]}</span><span className="break-words">{option}</span></Button>)}</div>
      </section> : null}
      {Object.keys(state.skills).length > 0 && <section className="border-t border-border pt-5"><h2 className="text-xs text-muted-foreground mb-3">本局技能</h2><div className="flex flex-wrap gap-x-6 gap-y-3">{Object.entries(state.skills).map(([key, level]) => { const skill = key as RogueSkill; const Icon = skillIcons[skill]; return <div className="flex items-center gap-2 text-sm" key={key} title={ROGUE_SKILLS[skill].detail}><Icon className="h-4 w-4 text-gold" />{ROGUE_SKILLS[skill].name}<span className="text-gold">Lv.{level}</span></div>; })}</div></section>}
    </main>}
    {error && <div className="mx-auto max-w-5xl px-4 py-5 flex flex-wrap items-center gap-4" role="alert"><span className="text-destructive text-sm">{error}</span>{pending && <Button variant="outline" disabled={busy} onClick={() => void execute(pending)}><RotateCcw className="h-4 w-4" />{pending.action === "answer" ? "重试原答案" : "重试"}</Button>}</div>}
    <AlertDialog open={exit} onOpenChange={setExit}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>放弃本局冒险？</AlertDialogTitle><AlertDialogDescription>放弃不发放狄邦豆。返回娱乐模式会保留进度，但计时不会暂停。</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>继续冒险</AlertDialogCancel><AlertDialogAction onClick={() => send("abandon")}>放弃冒险</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}