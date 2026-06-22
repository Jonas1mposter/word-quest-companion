import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Volume2, Check, X, Star, RotateCcw, Calculator } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSpeech } from "@/hooks/useSpeech";

interface MathWord {
  id: string;
  word: string;
  meaning: string;
  topic: number;
  topic_name: string;
  phonetic?: string;
  definition?: string;
}

interface MathWordLearningProps {
  levelId: string;
  levelName: string;
  words: MathWord[];
  onBack: () => void;
  onComplete: () => void;
}

type Phase = "learn" | "quiz" | "result";

const MathWordLearning = ({ levelId, levelName, words, onBack, onComplete }: MathWordLearningProps) => {
  const { profile, refreshProfile } = useAuth();
  const { speak } = useSpeech();
  const queryClient = useQueryClient();
  const [speaking, setSpeaking] = useState(false);
  
  const [phase, setPhase] = useState<Phase>("learn");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [quizOptions, setQuizOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [learnedWords, setLearnedWords] = useState<Set<string>>(new Set());

  const currentWord = words[currentIndex];
  const progress = ((currentIndex + 1) / words.length) * 100;

  // Generate quiz options
  const generateOptions = useCallback((correctWord: MathWord) => {
    const options = [correctWord.meaning];
    const otherWords = words.filter(w => w.id !== correctWord.id);
    
    while (options.length < 4 && otherWords.length > 0) {
      const randomIndex = Math.floor(Math.random() * otherWords.length);
      const randomWord = otherWords.splice(randomIndex, 1)[0];
      if (!options.includes(randomWord.meaning)) {
        options.push(randomWord.meaning);
      }
    }
    
    // Shuffle options
    return options.sort(() => Math.random() - 0.5);
  }, [words]);

  useEffect(() => {
    if (phase === "quiz" && currentWord) {
      setQuizOptions(generateOptions(currentWord));
      setSelectedAnswer(null);
      setIsAnswered(false);
    }
  }, [phase, currentIndex, currentWord, generateOptions]);

  const handleSpeak = () => {
    if (currentWord && !speaking) {
      setSpeaking(true);
      speak(currentWord.word);
      setTimeout(() => setSpeaking(false), 1000);
    }
  };

  const handleLearnNext = () => {
    setLearnedWords(prev => new Set(prev).add(currentWord.id));
    
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowMeaning(false);
    } else {
      // Move to quiz phase
      setPhase("quiz");
      setCurrentIndex(0);
    }
  };

  const finishLevel = async (finalCorrect: number) => {
    const accuracy = words.length > 0 ? finalCorrect / words.length : 0;
    const baseXp = 5;
    const baseCoins = 2;
    setXpEarned(baseXp + Math.floor(accuracy * 5));
    setCoinsEarned(baseCoins + (accuracy === 1 ? 3 : Math.floor(accuracy * 2)));
    setPhase("result");

    if (profile) {
      try {
        const { data, error } = await supabase.functions.invoke("complete-level", {
          body: {
            levelId: `MATH-${levelId}`,
            levelName,
            totalWords: words.length,
            correctCount: finalCorrect,
            maxCombo,
            isLetterLevel: false,
          },
        });
        if (error || (data && data.error)) {
          console.error("complete-level failed", error || data?.error);
        } else if (data) {
          setXpEarned(data.xpGained ?? xpEarned);
          setCoinsEarned(data.coinsGained ?? coinsEarned);
          if (data.leveledUp) toast.success(`🎉 升级了！现在是 Lv.${data.newLevel}！`);
        }
        await supabase.functions.invoke("increment-quest-progress", {
          body: { questType: "learn", amount: 1 },
        });
        if (finalCorrect > 0) {
          await supabase.functions.invoke("increment-quest-progress", {
            body: { questType: "words", amount: finalCorrect },
          });
        }
        await refreshProfile();
        queryClient.invalidateQueries({ queryKey: ["math-learning-progress", profile.id] });
      } catch (err) {
        console.error("Error finishing level:", err);
      }
    }
  };

  const handleQuizAnswer = async (answer: string) => {
    if (isAnswered) return;
    
    setSelectedAnswer(answer);
    setIsAnswered(true);
    
    const isCorrect = answer === currentWord.meaning;
    let nextCorrect = correctCount;
    
    if (isCorrect) {
      nextCorrect = correctCount + 1;
      setCorrectCount(nextCorrect);
      setCombo(prev => {
        const next = prev + 1;
        if (next > maxCombo) setMaxCombo(next);
        return next;
      });
    } else {
      setIncorrectCount(prev => prev + 1);
      setCombo(0);
    }

    // Save per-word progress without regressing mastery or accumulated counts
    if (profile) {
      try {
        const { data: existing } = await supabase
          .from("math_learning_progress")
          .select("id, mastery_level, correct_count, incorrect_count")
          .eq("profile_id", profile.id)
          .eq("word_id", currentWord.id)
          .maybeSingle();

        const nowIso = new Date().toISOString();
        if (existing) {
          await supabase
            .from("math_learning_progress")
            .update({
              mastery_level: Math.max(existing.mastery_level ?? 0, isCorrect ? 1 : 0),
              correct_count: (existing.correct_count ?? 0) + (isCorrect ? 1 : 0),
              incorrect_count: (existing.incorrect_count ?? 0) + (isCorrect ? 0 : 1),
              last_reviewed_at: nowIso,
              updated_at: nowIso,
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("math_learning_progress").insert({
            profile_id: profile.id,
            word_id: currentWord.id,
            mastery_level: isCorrect ? 1 : 0,
            correct_count: isCorrect ? 1 : 0,
            incorrect_count: isCorrect ? 0 : 1,
            last_reviewed_at: nowIso,
            updated_at: nowIso,
          });
        }
      } catch (err) {
        console.error("Error saving progress:", err);
      }
    }

    setTimeout(() => {
      if (currentIndex < words.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        finishLevel(nextCorrect);
      }
    }, 1500);
  };

  const handleRetry = () => {
    setPhase("learn");
    setCurrentIndex(0);
    setCorrectCount(0);
    setIncorrectCount(0);
    setShowMeaning(false);
    setLearnedWords(new Set());
  };

  const getStars = () => {
    const ratio = correctCount / words.length;
    if (ratio >= 0.9) return 3;
    if (ratio >= 0.7) return 2;
    if (ratio >= 0.5) return 1;
    return 0;
  };

  // Learning Phase
  if (phase === "learn") {
    return (
      <div className="min-h-screen bg-background bg-grid-pattern p-4">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Calculator className="w-3 h-3" />
              {levelName}
            </Badge>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>学习进度</span>
              <span>{currentIndex + 1} / {words.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Word Card */}
          <Card className="border-2 border-neon-cyan/30">
            <CardContent className="p-6 text-center space-y-4">
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-3xl font-bold">{currentWord?.word}</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleSpeak}
                  disabled={speaking}
                >
                  <Volume2 className={cn("w-5 h-5", speaking && "text-primary animate-pulse")} />
                </Button>
              </div>

              {currentWord?.phonetic && (
                <p className="text-muted-foreground">{currentWord.phonetic}</p>
              )}

              {showMeaning ? (
                <div className="space-y-3 animate-fade-in">
                  <p className="text-xl text-primary font-medium">{currentWord?.meaning}</p>
                  {currentWord?.definition && (
                    <p className="text-sm text-muted-foreground bg-secondary/50 rounded-lg p-3">
                      {currentWord.definition}
                    </p>
                  )}
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => setShowMeaning(true)}
                  className="w-full"
                >
                  显示释义
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Action Button */}
          {showMeaning && (
            <Button 
              variant="hero" 
              className="w-full" 
              onClick={handleLearnNext}
            >
              {currentIndex < words.length - 1 ? "下一个" : "开始测试"}
            </Button>
          )}

          {/* Word Preview */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {words.map((word, idx) => (
              <div
                key={word.id}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  idx === currentIndex && "w-4 bg-neon-cyan",
                  idx < currentIndex && learnedWords.has(word.id) && "bg-success",
                  idx > currentIndex && "bg-secondary"
                )}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Quiz Phase
  if (phase === "quiz") {
    return (
      <div className="min-h-screen bg-background bg-grid-pattern p-4">
        <div className="max-w-lg mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回
            </Button>
            <div className="flex items-center gap-2">
              <Badge variant="success" className="text-xs">
                <Check className="w-3 h-3 mr-0.5" />
                {correctCount}
              </Badge>
              <Badge variant="destructive" className="text-xs">
                <X className="w-3 h-3 mr-0.5" />
                {incorrectCount}
              </Badge>
            </div>
          </div>

          {/* Progress */}
          <Progress value={progress} className="h-2" />

          {/* Question */}
          <Card className="border-2 border-primary/30">
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground">选择正确的中文释义</p>
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl font-bold">{currentWord?.word}</h2>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleSpeak}
                  disabled={speaking}
                >
                  <Volume2 className={cn("w-4 h-4", speaking && "text-primary animate-pulse")} />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Options */}
          <div className="grid grid-cols-1 gap-2">
            {quizOptions.map((option, idx) => {
              const isCorrect = option === currentWord?.meaning;
              const isSelected = selectedAnswer === option;
              
              return (
                <Button
                  key={idx}
                  variant="outline"
                  className={cn(
                    "h-auto py-3 px-4 text-left justify-start",
                    isAnswered && isCorrect && "bg-success/20 border-success text-success-foreground",
                    isAnswered && isSelected && !isCorrect && "bg-destructive/20 border-destructive text-destructive-foreground",
                    !isAnswered && "hover:bg-primary/10 hover:border-primary"
                  )}
                  onClick={() => handleQuizAnswer(option)}
                  disabled={isAnswered}
                >
                  <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs mr-3">
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {option}
                  {isAnswered && isCorrect && <Check className="w-4 h-4 ml-auto text-success" />}
                  {isAnswered && isSelected && !isCorrect && <X className="w-4 h-4 ml-auto text-destructive" />}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Result Phase
  const stars = getStars();
  const accuracy = Math.round((correctCount / words.length) * 100);

  return (
    <div className="min-h-screen bg-background bg-grid-pattern p-4 flex items-center justify-center">
      <Card className="w-full max-w-md border-2 border-neon-cyan/30">
        <CardContent className="p-6 text-center space-y-6">
          <div className="space-y-2">
            <Calculator className="w-12 h-12 mx-auto text-neon-cyan" />
            <h2 className="text-2xl font-gaming">学习完成！</h2>
            <p className="text-muted-foreground">{levelName}</p>
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-2">
            {[1, 2, 3].map((star) => (
              <Star
                key={star}
                className={cn(
                  "w-10 h-10 transition-all",
                  star <= stars
                    ? "text-accent fill-accent animate-bounce-in"
                    : "text-muted-foreground/30"
                )}
                style={{ animationDelay: `${star * 0.2}s` }}
              />
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 py-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{correctCount}</p>
              <p className="text-xs text-muted-foreground">正确</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-destructive">{incorrectCount}</p>
              <p className="text-xs text-muted-foreground">错误</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{accuracy}%</p>
              <p className="text-xs text-muted-foreground">正确率</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={handleRetry}>
              <RotateCcw className="w-4 h-4 mr-2" />
              重新学习
            </Button>
            <Button variant="hero" className="flex-1" onClick={onComplete}>
              完成
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MathWordLearning;
