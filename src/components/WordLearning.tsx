import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMatchSounds } from "@/hooks/useMatchSounds";
import { haptics } from "@/lib/haptics";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import WordCard from "./WordCard";
import QuizCard, { QuizType } from "./QuizCard";
import { 
  ChevronLeft, 
  Star, 
  Zap, 
  CheckCircle,
  XCircle,
  Trophy,
  RotateCcw,
  Loader2,
  Shuffle,
  AlertTriangle,
  Battery,
  Flame
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateProfileWithXp } from "@/lib/levelUp";

const QUIZ_TYPES: { type: QuizType; label: string; icon: string }[] = [
  { type: "meaning", label: "选择释义", icon: "📖" },
  { type: "reverse", label: "选择单词", icon: "🔤" },
  { type: "spelling", label: "拼写单词", icon: "✍️" },
  { type: "listening", label: "听音拼写", icon: "🎧" },
  { type: "fillBlank", label: "填空", icon: "📝" },
];

interface WordLearningProps {
  levelId: string;
  levelName: string;
  onBack: () => void;
  onComplete: () => void;
}

interface Word {
  id: string;
  word: string;
  meaning: string;
  phonetic: string | null;
  example: string | null;
}

const WordLearning = ({ levelId, levelName, onBack, onComplete }: WordLearningProps) => {
  const { profile, refreshProfile } = useAuth();
  const sounds = useMatchSounds();
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<"learn" | "quiz">("learn");
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  // 保存最终结果，避免状态更新延迟问题
  const [finalCorrectCount, setFinalCorrectCount] = useState(0);
  const [finalIncorrectCount, setFinalIncorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set());
  const [energyDeducted, setEnergyDeducted] = useState(false);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showEnergyDialog, setShowEnergyDialog] = useState(false);
  // 连击系统
  const [comboCount, setComboCount] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [showComboPopup, setShowComboPopup] = useState(false);
  // 预加载的学习进度缓存
  const [existingProgress, setExistingProgress] = useState<Map<string, any>>(new Map());

  // 检查能量是否足够
  const hasEnoughEnergy = profile ? profile.energy >= 1 : false;

  useEffect(() => {
    const fetchWords = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }

      try {
        const letterMatch = levelId.match(/^([A-Z])-(\d+)$/);
        let fetchedWords: Word[] = [];
        
        if (letterMatch) {
          const letter = letterMatch[1];
          const subLevelIndex = parseInt(letterMatch[2]) - 1;
          const WORDS_PER_LEVEL = 10;

          const { data: wordsData, error: wordsError } = await supabase
            .from("words")
            .select("id, word, meaning, phonetic, example")
            .eq("grade", profile.grade)
            .ilike("word", `${letter}%`)
            .order("word", { ascending: true });

          if (wordsError) throw wordsError;

          const startIndex = subLevelIndex * WORDS_PER_LEVEL;
          const endIndex = startIndex + WORDS_PER_LEVEL;
          fetchedWords = wordsData?.slice(startIndex, endIndex) || [];
        } else {
          const { data: levelData, error: levelError } = await supabase
            .from("levels")
            .select("unit, grade")
            .eq("id", levelId)
            .single();

          if (levelError) throw levelError;

          const { data: wordsData, error: wordsError } = await supabase
            .from("words")
            .select("id, word, meaning, phonetic, example")
            .eq("grade", levelData.grade)
            .eq("unit", levelData.unit)
            .limit(10);

          if (wordsError) throw wordsError;
          fetchedWords = wordsData || [];
        }

        setWords(fetchedWords);

        // 预加载这些单词的学习进度（一次性查询）
        if (fetchedWords.length > 0) {
          const wordIds = fetchedWords.map(w => w.id);
          const { data: progressData } = await supabase
            .from("learning_progress")
            .select("*")
            .eq("profile_id", profile.id)
            .in("word_id", wordIds);

          const progressMap = new Map<string, any>();
          progressData?.forEach(p => progressMap.set(p.word_id, p));
          setExistingProgress(progressMap);
        }
      } catch (error) {
        console.error("Error fetching words:", error);
        toast.error("加载单词失败");
      } finally {
        setLoading(false);
      }
    };

    fetchWords();
  }, [levelId, profile]);

  const currentWord = words[currentIndex];
  const progress = words.length > 0 
    ? phase === "learn" 
      ? ((currentIndex + 1) / words.length) * 50 // Learning is 0-50%
      : 50 + ((currentIndex + 1) / words.length) * 50 // Quiz is 50-100%
    : 0;

  // Get options for meaning quiz (Chinese meanings)
  const getMeaningOptions = useMemo(() => {
    if (!currentWord) return [];
    const meanings = words.map(w => w.meaning);
    const correctMeaning = currentWord.meaning;
    const otherMeanings = meanings.filter(m => m !== correctMeaning);
    const shuffled = otherMeanings.sort(() => Math.random() - 0.5).slice(0, 3);
    return [...shuffled, correctMeaning].sort(() => Math.random() - 0.5);
  }, [currentWord, words]);

  // Get options for reverse quiz (English words)
  const getWordOptions = useMemo(() => {
    if (!currentWord) return [];
    const wordsList = words.map(w => w.word);
    const correctWord = currentWord.word;
    const otherWords = wordsList.filter(w => w !== correctWord);
    const shuffled = otherWords.sort(() => Math.random() - 0.5).slice(0, 3);
    return [...shuffled, correctWord].sort(() => Math.random() - 0.5);
  }, [currentWord, words]);

  // Get random quiz type for each question
  const getCurrentQuizType = useMemo(() => {
    const types: QuizType[] = ["meaning", "reverse", "spelling", "listening", "fillBlank"];
    return types[Math.floor(Math.random() * types.length)];
  }, [currentIndex]);

  const getQuizOptions = () => getMeaningOptions;

  // Mark word as learned - 使用缓存，无需查询
  const markWordAsLearned = async (word: Word) => {
    if (!profile) return;
    
    // 使用预加载的缓存判断
    if (!existingProgress.has(word.id)) {
      // 后台静默插入，不阻塞UI
      supabase
        .from("learning_progress")
        .insert({
          profile_id: profile.id,
          word_id: word.id,
          correct_count: 0,
          last_reviewed_at: new Date().toISOString(),
          mastery_level: 0,
        })
        .then(() => {
          // 更新缓存
          setExistingProgress(prev => new Map(prev).set(word.id, { word_id: word.id, correct_count: 0, incorrect_count: 0, mastery_level: 0 }));
        });
    }
  };

  // 能量扣除已合并到 complete-level（关卡结算时由服务端原子扣除）。
  // 这里保留接口签名，但仅在能量不足时弹窗，扣减由结算函数完成。
  const ensureEnergy = (): boolean => {
    if (!profile) return false;
    if (energyDeducted) return true;
    if (profile.energy < 1) {
      setShowEnergyDialog(true);
      return false;
    }
    setEnergyDeducted(true);
    return true;
  };

  // 处理退出
  const handleBack = () => {
    // 如果已经开始答题（测验阶段且已有进度），显示确认弹窗
    if (phase === "quiz" && (correctCount > 0 || incorrectCount > 0)) {
      setShowExitDialog(true);
    } else {
      onBack();
    }
  };

  const handleCorrect = async () => {
    if (!energyDeducted && phase === "quiz") {
      if (!ensureEnergy()) return;
    }
    
    const newCorrectCount = correctCount + 1;
    setCorrectCount(newCorrectCount);
    
    // 更新连击
    const newCombo = comboCount + 1;
    setComboCount(newCombo);
    if (newCombo > maxCombo) {
      setMaxCombo(newCombo);
    }
    
    // 显示连击提示 (3连击及以上)
    if (newCombo >= 3) {
      setShowComboPopup(true);
      setTimeout(() => setShowComboPopup(false), 800);
    }

    // 使用缓存更新学习进度
    if (profile && currentWord) {
      const existing = existingProgress.get(currentWord.id);
      
      if (existing) {
        // 后台更新，不阻塞
        supabase
          .from("learning_progress")
          .update({
            correct_count: (existing.correct_count || 0) + 1,
            last_reviewed_at: new Date().toISOString(),
            mastery_level: Math.min(5, (existing.mastery_level || 0) + 1),
          })
          .eq("id", existing.id);
        
        // 更新本地缓存
        existing.correct_count = (existing.correct_count || 0) + 1;
        existing.mastery_level = Math.min(5, (existing.mastery_level || 0) + 1);
      } else {
        supabase
          .from("learning_progress")
          .insert({
            profile_id: profile.id,
            word_id: currentWord.id,
            correct_count: 1,
            last_reviewed_at: new Date().toISOString(),
            mastery_level: 1,
          });
      }
    }

    nextWord(newCorrectCount, incorrectCount);
  };

  const handleIncorrect = async () => {
    if (!energyDeducted && phase === "quiz") {
      if (!ensureEnergy()) return;
    }
    
    const newIncorrectCount = incorrectCount + 1;
    setIncorrectCount(newIncorrectCount);
    
    // 重置连击
    setComboCount(0);

    if (profile && currentWord) {
      const existing = existingProgress.get(currentWord.id);

      if (existing) {
        supabase
          .from("learning_progress")
          .update({
            incorrect_count: (existing.incorrect_count || 0) + 1,
            last_reviewed_at: new Date().toISOString(),
            mastery_level: Math.max(1, existing.mastery_level || 0),
          })
          .eq("id", existing.id);
        
        existing.incorrect_count = (existing.incorrect_count || 0) + 1;
      } else {
        supabase
          .from("learning_progress")
          .insert({
            profile_id: profile.id,
            word_id: currentWord.id,
            incorrect_count: 1,
            last_reviewed_at: new Date().toISOString(),
            mastery_level: 1,
          });
      }
    }

    nextWord(correctCount, newIncorrectCount);
  };

  const nextWord = (currentCorrect: number, currentIncorrect: number) => {
    if (currentIndex < words.length - 1) {
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 500);
    } else {
      finishLevel(currentCorrect, currentIncorrect);
    }
  };

  const finishLevel = async (finalCorrect: number, finalIncorrect: number) => {
    // 保存最终分数，避免状态更新延迟问题
    setFinalCorrectCount(finalCorrect);
    setFinalIncorrectCount(finalIncorrect);
    
    const accuracy = words.length > 0 ? finalCorrect / words.length : 0;
    
    // Play completion sound based on performance
    if (accuracy >= 0.7) {
      sounds.playVictory();
      haptics.success();
    } else {
      sounds.playDefeat();
      haptics.warning();
    }
    
    // 占位显示（最终值以服务端返回为准）
    const baseXp = 5;
    const bonusXp = Math.floor(accuracy * 5);
    const baseCoins = 2;
    const bonusCoins = accuracy === 1 ? 3 : Math.floor(accuracy * 2);
    setXpEarned(baseXp + bonusXp);
    setCoinsEarned(baseCoins + bonusCoins);
    setShowResult(true);

    if (profile) {
      try {
        const letterMatch = levelId.match(/^([A-Z])-(\d+)$/);
        const { data, error } = await supabase.functions.invoke("complete-level", {
          body: {
            levelId,
            levelName,
            totalWords: words.length,
            correctCount: finalCorrect,
            maxCombo,
            isLetterLevel: !!letterMatch,
          },
        });

        if (error || (data && data.error)) {
          console.error("complete-level failed", error || data?.error);
        } else if (data) {
          setXpEarned(data.xpGained ?? baseXp + bonusXp);
          setCoinsEarned(data.coinsGained ?? baseCoins + bonusCoins);
          if (data.leveledUp) {
            toast.success(`🎉 升级了！现在是 Lv.${data.newLevel}！`);
          }
        }

        // Update daily quest progress (server-side)
        await Promise.all([
          supabase.functions.invoke("increment-quest-progress", {
            body: { questType: "learn", amount: 1 },
          }),
          finalCorrect > 0
            ? supabase.functions.invoke("increment-quest-progress", {
                body: { questType: "words", amount: finalCorrect },
              })
            : Promise.resolve(),
        ]);

        await refreshProfile();
      } catch (error) {
        console.error("Error finishing level:", error);
      }
    }
  };

  const getStars = () => {
    // 使用保存的最终正确数，避免状态更新延迟
    const accuracy = finalCorrectCount / words.length;
    if (accuracy >= 0.9) return 3;
    if (accuracy >= 0.7) return 2;
    if (accuracy >= 0.5) return 1;
    return 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="min-h-screen bg-background bg-grid-pattern flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">暂无单词数据</p>
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="w-4 h-4 mr-2" />
          返回
        </Button>
      </div>
    );
  }

  if (showResult) {
    const stars = getStars();
    const accuracy = Math.round((correctCount / words.length) * 100);

    return (
      <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center animate-scale-in">
          <div className={cn(
            "w-24 h-24 mx-auto mb-6 rounded-2xl flex items-center justify-center shadow-lg",
            stars >= 2 
              ? "bg-gradient-to-br from-accent to-amber-600 shadow-accent/30" 
              : "bg-gradient-to-br from-primary to-neon-pink shadow-primary/30"
          )}>
            <Trophy className="w-12 h-12 text-primary-foreground" />
          </div>

          <h2 className="font-gaming text-3xl mb-2 text-glow-purple">关卡完成！</h2>
          <p className="text-muted-foreground mb-6">{levelName}</p>

          {/* 低于两星提示 */}
          {stars < 2 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <span className="text-sm text-amber-200">
                需要获得至少2颗星才能解锁下一关，再试一次吧！
              </span>
            </div>
          )}

          <div className="flex justify-center gap-2 mb-8">
            {[1, 2, 3].map((star) => (
              <Star
                key={star}
                className={cn(
                  "w-10 h-10 transition-all duration-500",
                  star <= stars
                    ? "text-accent fill-accent drop-shadow-lg"
                    : "text-muted-foreground/30"
                )}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-success/10 rounded-xl p-4 border border-success/20">
              <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
              <div className="font-gaming text-2xl text-success">{finalCorrectCount}</div>
              <div className="text-xs text-muted-foreground">正确</div>
            </div>
            <div className="bg-destructive/10 rounded-xl p-4 border border-destructive/20">
              <XCircle className="w-6 h-6 text-destructive mx-auto mb-2" />
              <div className="font-gaming text-2xl text-destructive">{finalIncorrectCount}</div>
              <div className="text-xs text-muted-foreground">错误</div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-4 border border-border/50 mb-6">
            <div className="text-sm text-muted-foreground mb-2">正确率</div>
            <div className="font-gaming text-4xl text-primary">{accuracy}%</div>
          </div>

          <div className="flex justify-center gap-4 mb-8">
            <Badge variant="xp" className="text-base px-4 py-2">
              <Star className="w-4 h-4 mr-2" />
              +{xpEarned} XP
            </Badge>
            <Badge variant="gold" className="text-base px-4 py-2">
              🪙 +{coinsEarned}
            </Badge>
          </div>

          <div className="flex gap-4">
            <Button variant="outline" className="flex-1" onClick={onComplete}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
            <Button variant="hero" className="flex-1" onClick={() => {
              setCurrentIndex(0);
              setCorrectCount(0);
              setIncorrectCount(0);
              setFinalCorrectCount(0);
              setFinalIncorrectCount(0);
              setShowResult(false);
              setPhase("learn");
              setEnergyDeducted(false);
              setComboCount(0);
              setMaxCombo(0);
            }}>
              <RotateCcw className="w-4 h-4 mr-2" />
              再来一次
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grid-pattern">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
            <Badge variant="energy">
              <Zap className="w-3 h-3 mr-1" />
              {profile?.energy || 0} 能量
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-gaming">{levelName}</span>
              <span className="text-sm text-muted-foreground">
                {phase === "learn" ? "学习" : "测验"}: {currentIndex + 1} / {words.length}
              </span>
            </div>
            <Progress value={progress} variant="xp" className="h-2" />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-center gap-2 mb-4">
          <Badge 
            variant={phase === "learn" ? "default" : "outline"}
            className="px-4 py-2"
          >
            📖 学习阶段 ({learnedWords.size}/{words.length})
          </Badge>
          <Badge 
            variant={phase === "quiz" ? "default" : "outline"}
            className="px-4 py-2"
          >
            ✍️ 测验阶段
          </Badge>
        </div>
      </div>

      <main className="container mx-auto px-4 py-8">
        {/* Learning Phase - Show word cards */}
        {currentWord && phase === "learn" && (
          <WordCard
            key={currentWord.id}
            word={currentWord.word}
            meaning={currentWord.meaning}
            phonetic={currentWord.phonetic || undefined}
            example={currentWord.example || undefined}
            options={undefined}
            onCorrect={() => {
              markWordAsLearned(currentWord);
              setLearnedWords(prev => new Set([...prev, currentWord.id]));
              if (currentIndex < words.length - 1) {
                setCurrentIndex(prev => prev + 1);
              } else {
                setPhase("quiz");
                setCurrentIndex(0);
              }
            }}
            onIncorrect={() => {
              markWordAsLearned(currentWord);
              setLearnedWords(prev => new Set([...prev, currentWord.id]));
              if (currentIndex < words.length - 1) {
                setCurrentIndex(prev => prev + 1);
              } else {
                setPhase("quiz");
                setCurrentIndex(0);
              }
            }}
            mode="flashcard"
          />
        )}

        {/* Quiz Phase - Random question types */}
        {currentWord && phase === "quiz" && (
          <QuizCard
            key={`${currentWord.id}-${getCurrentQuizType}`}
            word={currentWord}
            quizType={getCurrentQuizType}
            options={getCurrentQuizType === "reverse" ? getWordOptions : getMeaningOptions}
            onCorrect={handleCorrect}
            onIncorrect={handleIncorrect}
            comboCount={comboCount}
          />
        )}

        {/* 连击提示弹窗 */}
        {showComboPopup && comboCount >= 3 && (
          <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50">
            <div className={cn(
              "animate-scale-in flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl",
              comboCount >= 10 ? "bg-gradient-to-r from-amber-500 to-orange-500" :
              comboCount >= 7 ? "bg-gradient-to-r from-purple-500 to-pink-500" :
              comboCount >= 5 ? "bg-gradient-to-r from-blue-500 to-cyan-500" :
              "bg-gradient-to-r from-green-500 to-emerald-500"
            )}>
              <Flame className={cn(
                "w-8 h-8 text-white",
                comboCount >= 5 && "animate-pulse"
              )} />
              <div className="text-white">
                <div className="font-gaming text-3xl">{comboCount} 连击!</div>
                <div className="text-sm opacity-80">
                  {comboCount >= 10 ? "无敌了！🔥" :
                   comboCount >= 7 ? "太强了！💪" :
                   comboCount >= 5 ? "继续保持！✨" :
                   "不错哦！👍"}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-center gap-8 mt-8">
          <div className="flex items-center gap-2 text-success">
            <CheckCircle className="w-5 h-5" />
            <span className="font-gaming">{correctCount}</span>
          </div>
          {/* 当前连击显示 */}
          {comboCount >= 2 && (
            <div className={cn(
              "flex items-center gap-2 transition-all",
              comboCount >= 5 ? "text-amber-500" : "text-orange-400"
            )}>
              <Flame className={cn("w-5 h-5", comboCount >= 5 && "animate-pulse")} />
              <span className="font-gaming">{comboCount}连击</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-destructive">
            <XCircle className="w-5 h-5" />
            <span className="font-gaming">{incorrectCount}</span>
          </div>
        </div>
      </main>

      {/* 退出确认弹窗 */}
      <AlertDialog open={showExitDialog} onOpenChange={setShowExitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              确定要退出吗？
            </AlertDialogTitle>
            <AlertDialogDescription>
              你正在进行测验，退出后当前进度将会丢失，已消耗的能量不会退还。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续答题</AlertDialogCancel>
            <AlertDialogAction 
              onClick={onBack}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              确认退出
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 能量不足弹窗 */}
      <AlertDialog open={showEnergyDialog} onOpenChange={setShowEnergyDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Battery className="w-5 h-5 text-amber-500" />
              能量不足
            </AlertDialogTitle>
            <AlertDialogDescription>
              你的能量不足以开始测验。能量会随时间自动恢复，也可以通过完成每日任务获取。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center justify-center py-4">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
              <Zap className="w-8 h-8 text-amber-500 mx-auto mb-2" />
              <div className="font-gaming text-2xl text-amber-500">{profile?.energy || 0}</div>
              <div className="text-xs text-muted-foreground">当前能量</div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onBack}>返回关卡</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WordLearning;
