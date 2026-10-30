import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Volume2, Headphones, BookOpen, Languages, PenLine } from "lucide-react";
import { Input } from "@/components/ui/input";
import { speakWord } from "@/hooks/useSpeech";
import { useMatchSounds } from "@/hooks/useMatchSounds";
import { haptics } from "@/lib/haptics";
import { BattleAnswerResult, fetchBattleAudio, ServerQuestion } from "@/lib/serverBattle";
import { cn } from "@/lib/utils";
import { audioManager } from "@/lib/audioManager";

export default function ServerBattleQuizCard({ question, onAnswer, comboCount, disabled, matchId, loadAudio, onHealthChange }: {
  question: ServerQuestion;
  onAnswer: (answer: string) => Promise<boolean | BattleAnswerResult>;
  comboCount: number;
  disabled?: boolean;
  matchId?: string;
  loadAudio?: (questionIndex: number) => Promise<Blob>;
  onHealthChange?: (healthy: boolean) => void;
}) {
  const sounds = useMatchSounds();
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [correctAnswer, setCorrectAnswer] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioBlobRef = useRef<Promise<Blob> | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const activeRef = useRef(true);
  const submitLock = useRef(false);
  const attemptedAnswer = useRef<string | null>(null);
  const type = question.quizType ?? "meaning";
  const prompt = question.prompt ?? question.word ?? "";
  const choice = type === "meaning" || type === "reverse";
  const labels = { meaning: "选择释义", reverse: "中译英", spelling: "拼写单词", listening: "听音拼写" };
  const TypeIcon = { meaning: BookOpen, reverse: Languages, spelling: PenLine, listening: Headphones }[type];
  // 健康门控只反映题目能否作答（提交中/加载出错）。发音未播放或失败不影响 DAC 监控，
  // 否则听力题在点击播放前整题无切屏检测，发音失败时整局失去监控。
  useEffect(() => {
    onHealthChange?.(!pending && !error);
  }, [pending, error, onHealthChange]);
  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      audioRef.current?.pause();
      audioSourceRef.current?.stop();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    };
  }, []);
  useEffect(() => {
    if (type !== "listening" || (!matchId && !loadAudio)) return;
    // Prefetch only this issued question's authenticated opaque bytes, not future answers.
    const promise = loadAudio ? loadAudio(question.questionIndex) : fetchBattleAudio(matchId ?? "", question.questionIndex);
    audioBlobRef.current = promise;
    void promise.catch(() => { if (audioBlobRef.current === promise) audioBlobRef.current = null; });
  }, [type, matchId, loadAudio, question.questionIndex]);
  const playListening = async () => {
    if ((!matchId && !loadAudio) || audioLoading) return;
    // Create the player synchronously on the click; never speak hidden answer text on the client.
    const audio = audioRef.current ?? new Audio();
    audioRef.current = audio;
    const contextReady = audioManager.ensureReady().catch(() => null);
    setAudioLoading(true); setAudioError(null);
    try {
      if (!audioUrlRef.current) {
        const blob = await (audioBlobRef.current ?? (loadAudio ? loadAudio(question.questionIndex) : matchId ? fetchBattleAudio(matchId, question.questionIndex) : Promise.resolve(null)));
        if (!blob) return;
        if (!activeRef.current) return;
        audioUrlRef.current = URL.createObjectURL(blob);
        audio.src = audioUrlRef.current;
      }
      audio.currentTime = 0;
      try { await audio.play(); }
      catch {
        // Safari may reject HTML playback after an async download. Unlock Web Audio on the click instead.
        const context = await contextReady;
        if (!context || context.state !== "running") throw new Error("Audio not ready");
        const blob = await fetch(audioUrlRef.current ?? "").then(response => response.arrayBuffer());
        const buffer = await context.decodeAudioData(blob);
        if (!activeRef.current) return;
        audioSourceRef.current?.stop();
        const source = context.createBufferSource();
        source.buffer = buffer; source.connect(context.destination); source.start();
        audioSourceRef.current = source;
      }
      if (activeRef.current) setAudioReady(true);
    } catch {
      if (activeRef.current) setAudioError("发音加载失败，请点击重试");
    } finally { if (activeRef.current) setAudioLoading(false); }
  };
  const submit = async (option: string) => {
    if (submitLock.current || pending || result !== null || disabled || (!choice && !option.trim()) || (type === "listening" && !audioReady)) return;
    submitLock.current = true;
    // A lost response may already have committed this answer. Never retry a different answer.
    attemptedAnswer.current ??= option;
    option = attemptedAnswer.current;
    setPending(true); setSelected(option); setError(null);
    try {
      const response = await onAnswer(option);
      const correct = typeof response === "boolean" ? response : response.isCorrect;
      if (!choice && typeof response !== "boolean" && typeof response.correctAnswer === "string") setCorrectAnswer(response.correctAnswer);
      setResult(correct);
      if (correct) { sounds.playCombo(comboCount + 1); haptics.success(); }
      else { sounds.playWrong(); haptics.error(); }
    } catch (err) {
      setError(err instanceof Error ? err.message : "答案提交失败，请重试");
    } finally { setPending(false); submitLock.current = false; }
  };
  return (
    <Card variant="glow" className={cn("max-w-lg mx-auto p-6 sm:p-8 text-center animate-scale-in transition-all motion-reduce:animate-none",
      result === true && "animate-correct-flash", result === false && "animate-wrong-shake")}>
      <div className="mb-6 flex justify-center">
        <span className={cn("inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium",
          type === "meaning" && "bg-primary/20 text-primary", type === "reverse" && "bg-neon-blue/20 text-neon-blue",
          type === "spelling" && "bg-neon-pink/20 text-neon-pink", type === "listening" && "bg-accent/20 text-accent")}>
          <TypeIcon className="w-4 h-4" />{labels[type]}
        </span>
      </div>
      {type === "listening" ? (
        <div className="mb-6">
          <Button variant="ghost" className="w-20 h-20 rounded-full bg-primary/20 hover:bg-primary/30 [&_svg]:size-10" aria-label="播放发音" title="播放发音"
            disabled={audioLoading || pending || result !== null || disabled} onClick={() => void playListening()}>
            {audioLoading ? <Loader2 className="text-primary animate-spin" /> : <Volume2 className="text-primary" />}
          </Button>
          <p className="mt-3 text-sm text-muted-foreground">点击播放发音</p>
          {audioError && <p role="alert" className="mt-2 text-sm text-destructive">{audioError}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 mb-8 min-w-0">
          <h2 data-no-translate className={cn("font-gaming text-glow-purple break-words [overflow-wrap:anywhere] min-w-0", type === "meaning" ? "text-4xl" : "text-3xl")}>{prompt}</h2>
          {type === "meaning" && <Button variant="ghost" size="icon" className="shrink-0 rounded-full bg-primary/10 hover:bg-primary/20" aria-label="播放发音" title="播放发音" onClick={() => speakWord(prompt)}>
            <Volume2 className="w-5 h-5 text-primary" />
          </Button>}
        </div>
      )}
      {choice ? <div className="grid gap-3">
        {question.options.map(option => (
          <Button key={option} variant="outline" disabled={pending || result !== null || disabled || (attemptedAnswer.current !== null && attemptedAnswer.current !== option)}
            onClick={() => void submit(option)} className={cn("h-auto min-h-14 py-4 px-4 whitespace-normal text-left justify-between gap-3 rounded-lg border-2 bg-card text-foreground hover:border-primary/50 hover:bg-primary/5 hover:text-foreground disabled:opacity-100",
              result !== null && selected !== option && "opacity-60",
              selected === option && pending && "border-primary bg-primary/10",
              selected === option && result === true && "border-success bg-success/10 text-success dark:text-success-foreground",
              selected === option && result === false && "border-destructive bg-destructive/10 text-destructive dark:text-destructive-foreground")}
          >
            <span data-no-translate className="break-words min-w-0">{option}</span>
            {selected === option && pending && <Loader2 className="w-5 h-5 shrink-0 animate-spin" />}
            {selected === option && result === true && <CheckCircle className="w-5 h-5 shrink-0" />}
            {selected === option && result === false && <XCircle className="w-5 h-5 shrink-0" />}
          </Button>
        ))}
      </div> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(input.trim()); }}>
        <Input data-no-translate aria-label="输入英文单词" placeholder="输入英文单词..." value={input} onChange={event => setInput(event.target.value)}
          disabled={pending || result !== null || disabled || attemptedAnswer.current !== null} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
          className={cn("h-14 text-center text-xl font-mono text-foreground", result === true && "border-success bg-success/10", result === false && "border-destructive bg-destructive/10")} />
        <Button type="submit" className="w-full h-12" disabled={!input.trim() || pending || result !== null || disabled || (type === "listening" && !audioReady)}>
          {pending ? <Loader2 className="animate-spin" /> : <CheckCircle />}确认
        </Button>
      </form>}
      {!choice && result !== null && correctAnswer && <div className="mt-4 text-sm text-muted-foreground" aria-live="polite">
        <span>正确答案</span><p data-no-translate className="mt-1 text-xl font-mono text-foreground break-words [overflow-wrap:anywhere]">{correctAnswer}</p>
      </div>}
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {error && attemptedAnswer.current !== null && <Button variant="outline" className="mt-3" disabled={pending || disabled} onClick={() => void submit(attemptedAnswer.current ?? "")}>重试原答案</Button>}
      <div aria-live="polite" className="min-h-6 mt-4 text-sm flex items-center justify-center gap-2">
        {result !== null && <><span className={result ? "text-success" : "text-destructive"}>{result ? "回答正确" : "回答错误"}</span><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></>}
      </div>
    </Card>
  );
}