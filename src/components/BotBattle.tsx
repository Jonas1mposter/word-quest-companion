import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Bot, ChevronLeft, Trophy, XCircle, Timer, Zap, Brain, Flame, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMatchSounds } from "@/hooks/useMatchSounds";
import SoundVariantSwitcher from "./battle/SoundVariantSwitcher";
import { cn } from "@/lib/utils";
import ServerBattleQuizCard from "./battle/ServerBattleQuizCard";
import { botAction, botQuestion, botAnswer, botAudio, type BotResult } from "@/lib/serverBotBattle";
import type { ServerQuestion } from "@/lib/serverBattle";
import KillStreakBanner from "./battle/KillStreakBanner";
import DacBadge from "./battle/DacBadge";

type Difficulty = "easy" | "medium" | "hard";
type Phase = "select" | "loading" | "countdown" | "battle" | "result";



const DIFF_CONFIG: Record<Difficulty, {
  label: string; desc: string; accuracy: number; minDelay: number; maxDelay: number;
  icon: typeof Bot; color: string; coins: string;
}> = {
  easy:   { label: "简单", desc: "新手AI · 反应慢、易出错",  accuracy: 0.30, minDelay: 5000, maxDelay: 9000, icon: Sparkles, color: "from-emerald-500 to-green-500", coins: "+10/+5/+2" },
  medium: { label: "中等", desc: "标准AI · 实力相当",        accuracy: 0.60, minDelay: 3000, maxDelay: 6000, icon: Brain,    color: "from-amber-500 to-orange-500",  coins: "+20/+10/+4" },
  hard:   { label: "困难", desc: "高手AI · 反应快、准确高",  accuracy: 0.85, minDelay: 2000, maxDelay: 4000, icon: Flame,    color: "from-rose-500 to-red-500",      coins: "+30/+15/+6" },
};

interface BotBattleProps { onBack: () => void; }

const BotBattle = ({ onBack }: BotBattleProps) => {
  const { profile, refreshProfile } = useAuth();
  const sounds = useMatchSounds();

  const [phase, setPhase] = useState<Phase>("select");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [question, setQuestion] = useState<ServerQuestion | null>(null);
  const [total, setTotal] = useState(10);
  const [error, setError] = useState<string | null>(null);
  const [finalResult, setFinalResult] = useState<BotResult | null>(null);
  const sessionRef = useRef<string | null>(null);
  const deadlineRef = useRef(0);
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(180);
  const [rewards, setRewards] = useState<{ xp: number; coins: number } | null>(null);
  const myScoreRef = useRef(0);
  const botScoreRef = useRef(0);
  const endedRef = useRef(false);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingForfeitRef = useRef<{ reason: string; meta: Record<string, number> } | null>(null);

  const finish = useCallback(async () => {
    const id = sessionRef.current;
    if (!id || endedRef.current) return;
    endedRef.current = true;
    if (tickerRef.current) clearInterval(tickerRef.current);
    if (advanceRef.current) clearTimeout(advanceRef.current);
    setQuestion(null);
    setPhase("result");
    try {
      const data = await botAction<BotResult>(id, 'finish');
      setFinalResult(data);
      setRewards({ xp: data.xpEarned, coins: data.coinsEarned });
      myScoreRef.current = data.playerScore; botScoreRef.current = data.botScore;
      if (data.result === 'win') sounds.playVictory();
      else if (data.result === 'loss') sounds.playDefeat();
      void refreshProfile();
    } catch { setError('结算未能确认，请重试'); }
  }, [sounds, refreshProfile]);

  const loadQuestion = useCallback(async () => {
    const id = sessionRef.current;
    if (!id || endedRef.current) return;
    setError(null);
    try {
      const data = await botQuestion(id);
      if (endedRef.current) return;
      if (data.done) { await finish(); return; }
      setQuestion(data); setCurrentQuestion(data.questionIndex); setTotal(data.total);
    } catch { setError('题目加载失败，请重试'); }
  }, [finish]);

  const forfeit = useCallback(async (reason: string, meta: Record<string, number>) => {
    const id = sessionRef.current;
    if (!id || endedRef.current) return;
    endedRef.current = true;
    pendingForfeitRef.current = { reason, meta };
    if (tickerRef.current) clearInterval(tickerRef.current);
    if (advanceRef.current) clearTimeout(advanceRef.current);
    setQuestion(null); setRewards(null); setPhase('result');
    setFinalResult({ ok: true, result: 'loss', playerScore: myScoreRef.current, botScore: botScoreRef.current, xpEarned: 0, coinsEarned: 0, forfeited: true });
    try {
      const data = await botAction<BotResult>(id, 'forfeit', { reason, meta });
      setFinalResult(data);
      pendingForfeitRef.current = null;
    } catch { setError('违规记录未能确认，请重试'); }
  }, []);

  const start = useCallback(async (diff: Difficulty) => {
    if (!profile) return;
    const id = crypto.randomUUID();
    sessionRef.current = id;
    setDifficulty(diff); setPhase('loading'); setError(null); setQuestion(null);
    setFinalResult(null); setRewards(null); setComboCount(0);
    try {
      const data = await botAction<{ total: number; startedAt: string }>(id, 'start', { difficulty: diff });
      setTotal(data.total); deadlineRef.current = Date.parse(data.startedAt) + 180000;
      myScoreRef.current = 0; botScoreRef.current = 0; endedRef.current = false;
      setMyScore(0); setBotScore(0); setCurrentQuestion(0);
      setCountdown(3); setTimeLeft(180); setPhase('countdown');
    } catch { setError('对局创建失败，请重试'); setPhase('select'); }
  }, [profile]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) { setPhase('battle'); void loadQuestion(); return; }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown, loadQuestion]);
  useEffect(() => {
    if (phase !== 'battle') return;
    tickerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (!remaining) void finish();
    }, 1000);
    return () => { if (tickerRef.current) clearInterval(tickerRef.current); };
  }, [phase, finish]);
  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  const handleAnswer = useCallback(async (answer: string) => {
    const id = sessionRef.current;
    if (!id || !question || endedRef.current) throw new Error('对局已结束');
    const data = await botAnswer(id, question.questionIndex, answer);
    if (endedRef.current) throw new Error('对局已结束');
    myScoreRef.current = data.playerScore; botScoreRef.current = data.botScore;
    setMyScore(data.playerScore); setBotScore(data.botScore);
    setComboCount(prev => data.isCorrect ? prev + 1 : 0);
    advanceRef.current = setTimeout(() => {
      if (endedRef.current) return;
      setQuestion(null);
      if (question.questionIndex + 1 >= question.total) void finish();
      else void loadQuestion();
    }, question.quizType === 'spelling' || question.quizType === 'listening' ? 2500 : 600);
    return data;
  }, [question, finish, loadQuestion]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Button variant="outline" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-2" />返回</Button>
      </div>
    );
  }

  if (phase === "select") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="max-w-lg mx-auto space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft className="w-5 h-5" /></Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />人机对抗 - 选择难度
              </h1>
              <p className="text-sm text-muted-foreground">和 AI 切磋词汇 · 经验 胜3 / 平2 / 负1</p>
            </div>
          </div>
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <div className="grid gap-3">
            {(Object.keys(DIFF_CONFIG) as Difficulty[]).map(d => {
              const cfg = DIFF_CONFIG[d];
              const Icon = cfg.icon;
              return (
                <Card key={d} className="cursor-pointer transition-all hover:scale-[1.01] border-2 hover:border-primary/40"
                  onClick={() => start(d)}>
                  <div className="p-4 flex items-center gap-4">
                    <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg", cfg.color)}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{cfg.label}</h3>
                        <Badge variant="secondary" className="text-xs">命中率 {Math.round(cfg.accuracy * 100)}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{cfg.desc}</p>
                      <p className="text-xs text-muted-foreground mt-1">狄邦豆 胜{cfg.coins.split('/')[0]} / 平{cfg.coins.split('/')[1]} / 负{cfg.coins.split('/')[2]}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <div className="space-y-1 text-center text-xs text-muted-foreground">
            <p>每日人机首胜 +50豆 · 满分完赛 +20豆</p>
            <p>至少完成10题；首胜北京时间每日重置，周末所有豆子双倍</p>
            <p>完整作答且至少答对1题才有豆子；未完成或违规退出不发奖励</p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Bot className="w-16 h-16 text-primary animate-pulse" />
        <DacBadge status="启动中" />
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-8 mb-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-2">
                <span className="font-gaming text-xl">{profile.username[0]?.toUpperCase()}</span>
              </div>
              <p className="text-sm">{profile.username}</p>
            </div>
            <div className="text-6xl font-gaming animate-pulse text-primary">VS</div>
            <div className="text-center">
              <div className={cn("w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-2 bg-gradient-to-br", DIFF_CONFIG[difficulty].color)}>
                <Bot className="w-10 h-10 text-white" />
              </div>
              <p className="text-sm">AI · {DIFF_CONFIG[difficulty].label}</p>
            </div>
          </div>
          <div className="text-8xl font-gaming animate-bounce text-primary">{countdown > 0 ? countdown : 'GO!'}</div>
        </div>
        <DacBadge status="启动中" />
      </div>
    );
  }

  if (phase === "battle") {
    const progressPercent = (currentQuestion / total) * 100;
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="default">{profile.username}</Badge>
              <span className="text-2xl font-gaming text-primary">{myScore}</span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className={cn("font-mono text-lg", timeLeft <= 30 && "text-destructive animate-pulse")}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-gaming text-neon-blue">{botScore}</span>
              <Badge variant="secondary"><Bot className="w-3 h-3 mr-1" />AI·{DIFF_CONFIG[difficulty].label}</Badge>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">第 {currentQuestion + 1}/{total} 题</span>
            {comboCount >= 2 && (
              <Badge variant="default" className="animate-pulse">
                <Zap className="w-3 h-3 mr-1" />{comboCount} 连击!
              </Badge>
            )}
          </div>
        </div>
        <KillStreakBanner combo={comboCount} />
        {question ? (
          <ServerBattleQuizCard key={question.questionIndex} question={question} onAnswer={handleAnswer}
            comboCount={comboCount} loadAudio={index => botAudio(sessionRef.current ?? '', index)} />
        ) : <div className="text-center py-12">
          {error ? <><p role="alert" className="text-destructive mb-3">{error}</p><Button onClick={() => void loadQuestion()}>重试</Button></> : <Bot className="w-12 h-12 mx-auto text-primary animate-pulse" />}
        </div>}
        <DacBadge onForfeit={forfeit} />
        <SoundVariantSwitcher />
      </div>
    );
  }

  if (phase === "result") {
    const isWin = finalResult?.result === 'win';
    const isDraw = finalResult?.result === 'draw';
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card variant="glow" className="max-w-md w-full p-8 text-center">
          {isDraw ? <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            : isWin ? <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
            : <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />}
          <h2 className="text-3xl font-gaming mb-2">{finalResult?.forfeited ? 'DAC 已终止对局' : !finalResult ? '结算中...' : isDraw ? '平局！' : isWin ? '战胜AI！' : '不敌AI'}</h2>
          <div className="flex items-center justify-center gap-8 my-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{profile.username}</p>
              <p className="text-4xl font-gaming text-primary">{myScoreRef.current}</p>
            </div>
            <span className="text-2xl text-muted-foreground">:</span>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">AI · {DIFF_CONFIG[difficulty].label}</p>
              <p className="text-4xl font-gaming text-neon-blue">{botScoreRef.current}</p>
            </div>
          </div>
          {finalResult?.forfeited && <p className="text-destructive mb-4">本局不发放奖励，已记录到 DAC 供管理员复核</p>}
          {error && <div className="mb-4"><p role="alert" className="text-destructive">{error}</p><Button variant="outline" onClick={() => {
            endedRef.current = false; setError(null);
            const pending = pendingForfeitRef.current;
            if (pending) void forfeit(pending.reason, pending.meta);
            else void finish();
          }}>重试</Button></div>}
          {rewards && (
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-gaming">
                +{rewards.xp} EXP
              </div>
              {rewards.coins > 0 && (
                <div className="px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-gaming">
                  +{rewards.coins} 狄邦豆
                </div>
              )}
            </div>
          )}
          {finalResult && !finalResult.forfeited && (
            <div className="mb-4 space-y-1 text-sm text-muted-foreground">
              {(finalResult.firstWinCoins ?? 0) > 0 && <p>每日首胜：+{finalResult.firstWinCoins} 狄邦豆</p>}
              {(finalResult.perfectCoins ?? 0) > 0 && <p>满分奖励：+{finalResult.perfectCoins} 狄邦豆</p>}
              {finalResult.weekend && <p>周末双倍豆已计入</p>}
            </div>
          )}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={!finalResult || !!error} onClick={() => { setError(null); setPhase("select"); }}>再战一局</Button>
            <Button className="flex-1" onClick={onBack}>返回</Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
};

export default BotBattle;
