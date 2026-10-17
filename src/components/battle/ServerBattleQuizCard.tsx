import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Volume2 } from "lucide-react";
import { speakWord } from "@/hooks/useSpeech";
import { useMatchSounds } from "@/hooks/useMatchSounds";
import { haptics } from "@/lib/haptics";
import { ServerQuestion } from "@/lib/serverBattle";
import { cn } from "@/lib/utils";

export default function ServerBattleQuizCard({ question, onAnswer, comboCount, disabled }: {
  question: ServerQuestion;
  onAnswer: (answer: string) => Promise<boolean>;
  comboCount: number;
  disabled?: boolean;
}) {
  const sounds = useMatchSounds();
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (option: string) => {
    if (pending || result !== null || disabled) return;
    setPending(true); setSelected(option); setError(null);
    try {
      const correct = await onAnswer(option);
      setResult(correct);
      if (correct) { sounds.playCombo(comboCount + 1); haptics.success(); }
      else { sounds.playWrong(); haptics.error(); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "答案提交失败，请重试");
      setSelected(null);
    } finally { setPending(false); }
  };
  return (
    <Card variant="glow" className="max-w-lg mx-auto p-6 sm:p-8 text-center animate-scale-in">
      <span className="text-xs text-primary">选择释义</span>
      <div className="flex items-center justify-center gap-3 my-6 min-w-0">
        <h2 className="text-3xl font-gaming break-words min-w-0">{question.word}</h2>
        <Button variant="ghost" size="icon" className="shrink-0" aria-label="播放发音" title="播放发音" onClick={() => speakWord(question.word)}>
          <Volume2 className="w-5 h-5 text-primary" />
        </Button>
      </div>
      <div className="grid gap-3">
        {question.options.map(option => (
          <Button key={option} variant="outline" disabled={pending || result !== null || disabled}
            onClick={() => void submit(option)} className={cn("h-auto min-h-14 py-4 px-4 whitespace-normal text-left justify-between gap-3 rounded-lg",
              selected === option && result === true && "border-success bg-success/10 text-success dark:text-success-foreground",
              selected === option && result === false && "border-destructive bg-destructive/10 text-destructive dark:text-destructive-foreground")}
          >
            <span className="break-words min-w-0">{option}</span>
            {selected === option && pending && <Loader2 className="w-5 h-5 shrink-0 animate-spin" />}
            {selected === option && result === true && <CheckCircle className="w-5 h-5 shrink-0" />}
            {selected === option && result === false && <XCircle className="w-5 h-5 shrink-0" />}
          </Button>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {result !== null && <p className="mt-4 text-sm text-muted-foreground">{result ? "回答正确" : "回答错误"}</p>}
    </Card>
  );
}