import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Bot, ChevronLeft, Trophy, XCircle, Timer, Zap, Brain, Flame, Sparkles, Swords } from "lucide-react";
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
  icon: typeof Bot; color: string;
}> = {
  easy:   { label: "简单", desc: "对手反应慢、易出错",        accuracy: 0.30, minDelay: 5000, maxDelay: 9000, icon: Sparkles, color: "from-emerald-500 to-green-500" },
  medium: { label: "中等", desc: "标准 AI · 实力相当",         accuracy: 0.60, minDelay: 3000, maxDelay: 6000, icon: Brain,    color: "from-amber-500 to-orange-500" },
  hard:   { label: "困难", desc: "高手 AI · 反应快、准确高",   accuracy: 0.85, minDelay: 2000, maxDelay: 4000, icon: Flame,    color: "from-rose-500 to-red-500" },
};

const BOT_NAMES = ["Echo", "Nova", "Vega", "Orion", "Iris", "Lyra", "Atlas", "Zephyr"];
const pickName = (used: Set<string>) => {
  const pool = BOT_NAMES.filter(n => !used.has(n));
  const n = pool[Math.floor(Math.random() * pool.length)] || "Bot";
  used.add(n);
  return n;
};

interface Props { onBack: () => void; }

const Battle2v2Practice = ({ onBack }: Props) => {
  const { profile } = useAuth();
  const sounds = useMatchSounds();

  const [phase, setPhase] = useState<Phase>("select");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [words, setWords] = useState<Word[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [team1Score, setTeam1Score] = useState(0);
  const [team2Score, setTeam2Score] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [answerAnimation, setAnswerAnimation] = useState<'correct' | 'wrong' | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(300);
  const [options, setOptions] = useState<string[]>([]);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [quizType, setQuizType] = useState<BattleQuizType>("meaning");
  const [botNames] = useState(() => {
    const used = new Set<string>();
    return { teammate: pickName(used), opp1: pickName(used), opp2: pickName(used) };
  });

  const t1Ref = useRef(0);
  const t2Ref = useRef(0);
  const endedRef = useRef(false);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const botTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const generateOptions = useCallback((ws: Word[], idx: number) => {
    const cur = ws[idx]; if (!cur) return;
    const ms = ws.filter((_, i) => i !== idx).map(w => w.meaning).sort(() => Math.random() - 0.5).slice(0, 3);
    setOptions([...ms, cur.meaning].sort(() => Math.random() - 0.5));
    const wo = ws.filter((_, i) => i !== idx).map(w => w.word).sort(() => Math.random() - 0.5).slice(0, 3);
    setWordOptions([...wo, cur.word].sort(() => Math.random() - 0.5));
    setQuizType(QUIZ_TYPES[idx % QUIZ_TYPES.length]);
  }, []);

  const clearBotTimers = () => {
    botTimersRef.current.forEach(t => clearTimeout(t));
    botTimersRef.current = [];
  };

  const finish = useCallback(() => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (tickerRef.current) clearInterval(tickerRef.current);
    clearBotTimers();
    if (t1Ref.current > t2Ref.current) sounds.playVictory();
    else if (t1Ref.current < t2Ref.current) sounds.playDefeat();
    setPhase("result");
  }, [sounds]);

  // schedule 3 bots' "answers" each question
  const scheduleBots = useCallback(() => {
    clearBotTimers();
    const cfg = DIFF_CONFIG[difficulty];
    const fire = (team: 1 | 2) => {
      const delay = cfg.minDelay + Math.random() * (cfg.maxDelay - cfg.minDelay);
      const tid = setTimeout(() => {
        if (endedRef.current) return;
        if (Math.random() < cfg.accuracy) {
          if (team === 1) { t1Ref.current += 1; setTeam1Score(t1Ref.current); }
          else { t2Ref.current += 1; setTeam2Score(t2Ref.current); }
        }
      }, delay);
      botTimersRef.current.push(tid);
    };
    fire(1); // teammate
    fire(2); fire(2); // 2 opponents
  }, [difficulty]);

  const start = useCallback(async (diff: Difficulty) => {
    if (!profile) return;
    setDifficulty(diff);
    setPhase("loading");
    const { data } = await supabase
      .from("words").select("id, word, meaning, phonetic, example")
      .eq("grade", profile.grade).limit(300);
    const pool = (data || []).sort(() => Math.random() - 0.5).slice(0, 15);
    if (pool.length < 4) { setPhase("select"); return; }
    setWords(pool);
    generateOptions(pool, 0);
    setCurrentQuestion(0); setTeam1Score(0); setTeam2Score(0);
    t1Ref.current = 0; t2Ref.current = 0;
    endedRef.current = false;
    setCountdown(3); setTimeLeft(300);
    setPhase("countdown");
  }, [profile, generateOptions]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("battle");
      tickerRef.current = setInterval(() => {
        setTimeLeft(p => { if (p <= 1) { finish(); return 0; } return p - 1; });
      }, 1000);
      scheduleBots();
      return;
    }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, finish, scheduleBots]);

  useEffect(() => () => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    clearBotTimers();
  }, []);

  const handleAnswer = useCallback((isCorrect: boolean) => {
    if (endedRef.current) return;
    if (isCorrect) { t1Ref.current += 1; setTeam1Score(t1Ref.current); }
    setComboCount(prev => isCorrect ? prev + 1 : 0);
    setAnswerAnimation(isCorrect ? "correct" : "wrong");
    setTimeout(() => setAnswerAnimation(null), 500);
    const next = currentQuestion + 1;
    if (next >= words.length) { finish(); return; }
    setCurrentQuestion(next);
    generateOptions(words, next);
    scheduleBots();
  }, [currentQuestion, words, generateOptions, finish, scheduleBots]);

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
                <Swords className="w-5 h-5 text-primary" />2v2 练习模式
              </h1>
              <p className="text-sm text-muted-foreground">你 + 队友 Bot · 对战 2 个 Bot · 不计排位/奖励</p>
            </div>
          </div>
          <div className="grid gap-3">
            {(Object.keys(DIFF_CONFIG) as Difficulty[]).map(d => {
              const cfg = DIFF_CONFIG[d]; const Icon = cfg.icon;
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
                        <Badge variant="secondary" className="text-xs">Bot 命中率 {Math.round(cfg.accuracy * 100)}%</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{cfg.desc}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground">15 题 · 个人得分计入己方队伍总分</p>
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Swords className="w-16 h-16 text-primary animate-pulse" /></div>;
  }

  if (phase === "countdown") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-4 mb-8 flex-wrap">
            <div className="flex gap-2">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-1">
                  <span className="font-gaming">{profile.username[0]?.toUpperCase()}</span>
                </div>
                <p className="text-xs">{profile.username}</p>
              </div>
              <div className="text-center">
                <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-1 bg-gradient-to-br", DIFF_CONFIG[difficulty].color)}>
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <p className="text-xs">{botNames.teammate}</p>
              </div>
            </div>
            <div className="text-5xl font-gaming animate-pulse text-primary">VS</div>
            <div className="flex gap-2">
              {[botNames.opp1, botNames.opp2].map(n => (
                <div key={n} className="text-center">
                  <div className={cn("w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-1 bg-gradient-to-br", DIFF_CONFIG[difficulty].color)}>
                    <Bot className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-xs">{n}</p>
                </div>
              ))}
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
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <Badge variant="default" className="text-[10px]">{profile.username}</Badge>
                <Badge variant="default" className="text-[10px]"><Bot className="w-2.5 h-2.5 mr-1" />{botNames.teammate}</Badge>
              </div>
              <span className="text-2xl font-gaming text-primary">{team1Score}</span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className={cn("font-mono text-lg", timeLeft <= 30 && "text-destructive animate-pulse")}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-gaming text-neon-blue">{team2Score}</span>
              <div className="flex flex-col gap-0.5">
                <Badge variant="secondary" className="text-[10px]"><Bot className="w-2.5 h-2.5 mr-1" />{botNames.opp1}</Badge>
                <Badge variant="secondary" className="text-[10px]"><Bot className="w-2.5 h-2.5 mr-1" />{botNames.opp2}</Badge>
              </div>
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
          <BattleQuizCard word={currentWord} quizType={quizType}
            options={options} wordOptions={wordOptions}
            onAnswer={(c) => handleAnswer(c)}
            answerAnimation={answerAnimation} comboCount={comboCount} />
        )}
      </div>
    );
  }

  if (phase === "result") {
    const isWin = t1Ref.current > t2Ref.current;
    const isDraw = t1Ref.current === t2Ref.current;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card variant="glow" className="max-w-md w-full p-8 text-center">
          {isDraw ? <Swords className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            : isWin ? <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
            : <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />}
          <h2 className="text-3xl font-gaming mb-2">{isDraw ? '平局！' : isWin ? '团队胜利！' : '团队失败'}</h2>
          <div className="flex items-center justify-center gap-8 my-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">我方</p>
              <p className="text-4xl font-gaming text-primary">{t1Ref.current}</p>
            </div>
            <span className="text-2xl text-muted-foreground">:</span>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">对方</p>
              <p className="text-4xl font-gaming text-neon-blue">{t2Ref.current}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-4">练习模式不计入战绩，不发放奖励</p>
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

export default Battle2v2Practice;
