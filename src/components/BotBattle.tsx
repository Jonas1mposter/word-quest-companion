import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Bot, ChevronLeft, Trophy, XCircle, Timer, Zap, Brain, Flame, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMatchSounds } from "@/hooks/useMatchSounds";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import BattleQuizCard, { BattleQuizType } from "./battle/BattleQuizCard";
import KillStreakBanner from "./battle/KillStreakBanner";

type Difficulty = "easy" | "medium" | "hard";
type Phase = "select" | "loading" | "countdown" | "battle" | "result";

interface Word { id: string; word: string; meaning: string; phonetic?: string | null; example?: string | null; }

const QUIZ_TYPES: BattleQuizType[] = ["meaning", "reverse", "spelling", "listening"];

const DIFF_CONFIG: Record<Difficulty, {
  label: string; desc: string; accuracy: number; minDelay: number; maxDelay: number;
  icon: typeof Bot; color: string; coins: string;
}> = {
  easy:   { label: "简单", desc: "新手AI · 反应慢、易出错",  accuracy: 0.30, minDelay: 5000, maxDelay: 9000, icon: Sparkles, color: "from-emerald-500 to-green-500", coins: "+3/+1" },
  medium: { label: "中等", desc: "标准AI · 实力相当",        accuracy: 0.60, minDelay: 3000, maxDelay: 6000, icon: Brain,    color: "from-amber-500 to-orange-500",  coins: "+5/+2" },
  hard:   { label: "困难", desc: "高手AI · 反应快、准确高",  accuracy: 0.85, minDelay: 2000, maxDelay: 4000, icon: Flame,    color: "from-rose-500 to-red-500",      coins: "+8/+3" },
};

interface BotBattleProps { onBack: () => void; }

const BotBattle = ({ onBack }: BotBattleProps) => {
  const { profile, refreshProfile } = useAuth();
  const sounds = useMatchSounds();

  const [phase, setPhase] = useState<Phase>("select");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [words, setWords] = useState<Word[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [myScore, setMyScore] = useState(0);
  const [botScore, setBotScore] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [answerAnimation, setAnswerAnimation] = useState<'correct' | 'wrong' | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(180);
  const [options, setOptions] = useState<string[]>([]);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [quizType, setQuizType] = useState<BattleQuizType>("meaning");
  const [rewards, setRewards] = useState<{ xp: number; coins: number } | null>(null);

  const myScoreRef = useRef(0);
  const botScoreRef = useRef(0);
  const endedRef = useRef(false);
  const botTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateOptions = useCallback((ws: Word[], idx: number) => {
    const cur = ws[idx]; if (!cur) return;
    const ms = ws.filter((_, i) => i !== idx).map(w => w.meaning).sort(() => Math.random() - 0.5).slice(0, 3);
    setOptions([...ms, cur.meaning].sort(() => Math.random() - 0.5));
    const wo = ws.filter((_, i) => i !== idx).map(w => w.word).sort(() => Math.random() - 0.5).slice(0, 3);
    setWordOptions([...wo, cur.word].sort(() => Math.random() - 0.5));
    setQuizType(QUIZ_TYPES[idx % QUIZ_TYPES.length]);
  }, []);

  const finish = useCallback(async () => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (tickerRef.current) clearInterval(tickerRef.current);
    if (botTimerRef.current) clearTimeout(botTimerRef.current);

    const my = myScoreRef.current;
    const bot = botScoreRef.current;
    const result = my > bot ? "win" : my < bot ? "loss" : "draw";
    if (result === "win") sounds.playVictory();
    else if (result === "loss") sounds.playDefeat();

    try {
      const { data } = await supabase.functions.invoke("bot-match-reward", {
        body: { result, difficulty },
      });
      if (data?.ok) setRewards({ xp: data.xpEarned, coins: data.coinsEarned });
    } catch (e) { console.error("bot-match-reward failed", e); }
    refreshProfile();
    setPhase("result");
  }, [difficulty, sounds, refreshProfile]);

  // Schedule bot's "answer" for the current question
  const scheduleBotAnswer = useCallback((qIdx: number) => {
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
    const cfg = DIFF_CONFIG[difficulty];
    const delay = cfg.minDelay + Math.random() * (cfg.maxDelay - cfg.minDelay);
    botTimerRef.current = setTimeout(() => {
      if (endedRef.current) return;
      // Only count if we haven't moved past this question yet (player already answered)
      const correct = Math.random() < cfg.accuracy;
      if (correct) {
        botScoreRef.current += 1;
        setBotScore(botScoreRef.current);
      }
    }, delay);
  }, [difficulty]);

  const start = useCallback(async (diff: Difficulty) => {
    if (!profile) return;
    setDifficulty(diff);
    setPhase("loading");
    // Pull 10 random words for the grade (English curriculum)
    const { data } = await supabase
      .from("words").select("id, word, meaning, phonetic, example")
      .eq("grade", profile.grade)
      .limit(200);
    const pool = (data || []).sort(() => Math.random() - 0.5).slice(0, 10);
    if (pool.length < 4) {
      setPhase("select");
      return;
    }
    setWords(pool);
    generateOptions(pool, 0);
    setCurrentQuestion(0); setMyScore(0); setBotScore(0);
    myScoreRef.current = 0; botScoreRef.current = 0;
    endedRef.current = false;
    setCountdown(3); setTimeLeft(180); setRewards(null);
    setPhase("countdown");
  }, [profile, generateOptions]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("battle");
      tickerRef.current = setInterval(() => {
        setTimeLeft(p => { if (p <= 1) { finish(); return 0; } return p - 1; });
      }, 1000);
      scheduleBotAnswer(0);
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, finish, scheduleBotAnswer]);

  useEffect(() => () => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
  }, []);

  const handleAnswer = useCallback((isCorrect: boolean) => {
    if (endedRef.current) return;
    if (isCorrect) {
      myScoreRef.current += 1;
      setMyScore(myScoreRef.current);
    }
    setComboCount(prev => isCorrect ? prev + 1 : 0);
    setAnswerAnimation(isCorrect ? "correct" : "wrong");
    setTimeout(() => setAnswerAnimation(null), 500);
    const next = currentQuestion + 1;
    if (next >= words.length) { finish(); return; }
    setCurrentQuestion(next);
    generateOptions(words, next);
    scheduleBotAnswer(next);
  }, [currentQuestion, words, generateOptions, finish, scheduleBotAnswer]);

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
                      <p className="text-xs text-muted-foreground mt-1">狄邦豆 胜{cfg.coins.split('/')[0]} / 平{cfg.coins.split('/')[1]}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground">人机模式不计入排位和ELO，仅奖励少量经验和狄邦豆</p>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Bot className="w-16 h-16 text-primary animate-pulse" />
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
      </div>
    );
  }

  if (phase === "battle") {
    const currentWord = words[currentQuestion];
    const progressPercent = (currentQuestion / words.length) * 100;
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
            <span className="text-xs text-muted-foreground">第 {currentQuestion + 1}/{words.length} 题</span>
            {comboCount >= 2 && (
              <Badge variant="default" className="animate-pulse">
                <Zap className="w-3 h-3 mr-1" />{comboCount} 连击!
              </Badge>
            )}
          </div>
        </div>
        <KillStreakBanner combo={comboCount} />
        {currentWord && (
          <BattleQuizCard
            word={currentWord} quizType={quizType}
            options={options} wordOptions={wordOptions}
            onAnswer={(c) => handleAnswer(c)}
            answerAnimation={answerAnimation}
            comboCount={comboCount}
          />
        )}
      </div>
    );
  }

  if (phase === "result") {
    const isWin = myScoreRef.current > botScoreRef.current;
    const isDraw = myScoreRef.current === botScoreRef.current;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card variant="glow" className="max-w-md w-full p-8 text-center">
          {isDraw ? <Bot className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            : isWin ? <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
            : <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />}
          <h2 className="text-3xl font-gaming mb-2">{isDraw ? '平局！' : isWin ? '战胜AI！' : '不敌AI'}</h2>
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
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setPhase("select")}>再战一局</Button>
            <Button className="flex-1" onClick={onBack}>返回</Button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
};

export default BotBattle;
