import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Trophy, XCircle, Timer, Zap, LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMatchQueue } from "@/hooks/useMatchQueue";
import { useMatchSounds } from "@/hooks/useMatchSounds";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import BattleQuizCard, { BattleQuizType } from "./BattleQuizCard";
import PlayerBattleCard from "./PlayerBattleCard";
import { cancelPlayerStaleMatches } from "@/hooks/useMatchCleanup";

interface Word {
  id: string;
  word: string;
  meaning: string;
  phonetic?: string | null;
  example?: string | null;
}

interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  words: Word[];
  status: string;
  grade: number;
  started_at: string;
  winner_id: string | null;
}

type BattlePhase = "searching" | "found" | "countdown" | "battle" | "result";

const QUIZ_TYPES: BattleQuizType[] = ["meaning", "reverse", "spelling", "listening"];

export interface BattleArenaTheme {
  /** Tailwind text color class for primary accents (e.g. "text-primary") */
  accentText: string;
  /** Tailwind border color class (e.g. "border-primary/30 border-t-primary") */
  accentSpinner: string;
  /** Heading shown while searching */
  searchingTitle: string;
  /** Subtitle line under searching title */
  searchingSubtitle: (profile: { grade: number; elo: number }) => string;
  /** Icon shown across phases */
  Icon: LucideIcon;
  /** Use ranked or free wins/losses fields on profile */
  winsField: "wins" | "free_match_wins";
  lossesField: "losses" | "free_match_losses";
}

export interface BattleArenaProps {
  onBack: () => void;
  initialMatchId?: string | null;
  subject?: string;
  matchType: "ranked" | "free";
  eloField: "elo_rating" | "elo_free";
  theme: BattleArenaTheme;
}

const BattleArena = ({
  onBack,
  initialMatchId,
  subject = "mixed",
  matchType,
  eloField,
  theme,
}: BattleArenaProps) => {
  const { profile } = useAuth();
  const sounds = useMatchSounds();
  const Icon = theme.Icon;

  const [phase, setPhase] = useState<BattlePhase>(initialMatchId ? "found" : "searching");
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<any>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [answerAnimation, setAnswerAnimation] = useState<'correct' | 'wrong' | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(300);
  const [options, setOptions] = useState<string[]>([]);
  const [wordOptions, setWordOptions] = useState<string[]>([]);
  const [quizType, setQuizType] = useState<BattleQuizType>("meaning");
  const [searchTime, setSearchTime] = useState(0);

  const myScoreRef = useRef(0);
  const [myScoreDisplay, setMyScoreDisplay] = useState(0);
  const matchEndedRef = useRef(false);
  const answeringRef = useRef(false);
  const winnerIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);
  const isPlayer1Ref = useRef(false);

  const generateOptions = useCallback((words: Word[], idx: number) => {
    const cur = words[idx];
    if (!cur) return;
    const otherMeanings = words.filter((_, i) => i !== idx).map(w => w.meaning).sort(() => Math.random() - 0.5).slice(0, 3);
    setOptions([...otherMeanings, cur.meaning].sort(() => Math.random() - 0.5));
    const otherWords = words.filter((_, i) => i !== idx).map(w => w.word).sort(() => Math.random() - 0.5).slice(0, 3);
    setWordOptions([...otherWords, cur.word].sort(() => Math.random() - 0.5));
    setQuizType(QUIZ_TYPES[idx % QUIZ_TYPES.length]);
  }, []);

  const loadMatch = useCallback(async (matchId: string) => {
    const { data: match } = await supabase.from('ranked_matches').select('*').eq('id', matchId).single();
    if (!match || !profile) return;
    const words = (match.words as any[]) || [];
    isPlayer1Ref.current = match.player1_id === profile.id;
    setMatchData({ ...match, words, player1_id: match.player1_id!, player2_id: match.player2_id! });
    const opponentId = isPlayer1Ref.current ? match.player2_id : match.player1_id;
    const { data: opp } = await supabase.from('profiles').select('*').eq('id', opponentId!).single();
    setOpponentProfile(opp);
    if (words.length > 0) generateOptions(words, 0);

    const channel = supabase.channel(`match-${matchId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_answers', filter: `match_id=eq.${matchId}` }, (payload) => {
        const a = payload.new as any;
        if (a.player_id !== profile.id && a.is_correct) setOpponentScore(prev => prev + 1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ranked_matches', filter: `id=eq.${matchId}` }, (payload) => {
        const u = payload.new as any;
        if (u.winner_id) winnerIdRef.current = u.winner_id;
        if (u.status === 'completed' && !matchEndedRef.current) {
          matchEndedRef.current = true;
          setPhase("result");
        }
        setOpponentScore(isPlayer1Ref.current ? u.player2_score : u.player1_score);
      })
      .subscribe();
    channelRef.current = channel;
    setPhase("countdown");
  }, [profile, generateOptions]);

  const handleMatchFound = useCallback((matchId: string) => {
    sounds.playMatchFound();
    setPhase("found");
    setTimeout(() => loadMatch(matchId), 1000);
  }, [loadMatch, sounds]);

  const { joinQueue, leaveQueue, error: queueError } = useMatchQueue({
    profileId: profile?.id || null,
    grade: profile?.grade || 7,
    matchType,
    eloRating: (profile as any)?.[eloField] || 1000,
    enabled: !!profile,
    subject,
    onMatchFound: handleMatchFound,
  });

  useEffect(() => {
    if (!profile) return;
    if (initialMatchId) loadMatch(initialMatchId);
    else cancelPlayerStaleMatches(profile.id, profile.grade).then(() => joinQueue());
    return () => {
      leaveQueue();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (phase !== "searching") return;
    const i = setInterval(() => setSearchTime(p => p + 1), 1000);
    return () => clearInterval(i);
  }, [phase]);

  const endMatch = useCallback(async () => {
    if (!profile || matchEndedRef.current) return;
    matchEndedRef.current = true;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    await new Promise(r => setTimeout(r, 500));
    if (!matchData?.id) { setPhase("result"); return; }
    try {
      const { data, error } = await supabase.functions.invoke('process-match', { body: { matchId: matchData.id } });
      if (error || (data && data.error)) console.error('process-match failed', error || data?.error);
      else if (data) winnerIdRef.current = data.winnerId ?? null;
    } catch (e) {
      console.error('process-match exception', e);
    }
    const winnerId = winnerIdRef.current;
    if (winnerId === profile.id) sounds.playVictory();
    else if (winnerId !== null) sounds.playDefeat();
    setPhase("result");
  }, [matchData, profile, sounds]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("battle");
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => { if (prev <= 1) { endMatch(); return 0; } return prev - 1; });
      }, 1000);
      return;
    }
    const t = setTimeout(() => setCountdown(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, endMatch]);

  const handleAnswer = useCallback(async (clientCorrect: boolean, answer: string) => {
    if (!matchData || !profile || matchEndedRef.current || answeringRef.current) return;
    answeringRef.current = true;
    try {
      const idx = currentQuestion;
      const { data, error } = await supabase.functions.invoke('submit-answer', {
        body: { matchId: matchData.id, questionIndex: idx, answer, quizType },
      });
      const serverCorrect = !error && data && !data.error ? !!data.isCorrect : clientCorrect;
      if (serverCorrect) {
        const ns = myScoreRef.current + 1;
        myScoreRef.current = ns;
        setMyScoreDisplay(ns);
      }
      setComboCount(prev => serverCorrect ? prev + 1 : 0);
      setAnswerAnimation(serverCorrect ? 'correct' : 'wrong');
      setTimeout(() => setAnswerAnimation(null), 500);
      const next = idx + 1;
      if (next >= matchData.words.length) endMatch();
      else { setCurrentQuestion(next); generateOptions(matchData.words, next); }
    } finally {
      answeringRef.current = false;
    }
  }, [matchData, profile, currentQuestion, quizType, generateOptions, endMatch]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <Icon className={cn("w-16 h-16 mx-auto mb-4", theme.accentText)} />
          <h2 className="text-2xl font-bold mb-4">请先登录</h2>
          <Button variant="outline" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-2" />返回</Button>
        </div>
      </div>
    );
  }

  if (phase === "searching") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="relative mb-8">
            <Icon className={cn("w-20 h-20 mx-auto animate-pulse", theme.accentText)} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={cn("w-32 h-32 rounded-full border-4 animate-spin", theme.accentSpinner)} />
            </div>
          </div>
          <h2 className="text-2xl font-gaming mb-2">{theme.searchingTitle}</h2>
          <p className="text-muted-foreground mb-2">
            {theme.searchingSubtitle({ grade: profile.grade, elo: (profile as any)[eloField] || 1000 })}
          </p>
          <p className="text-sm text-muted-foreground mb-2">搜索时间: {searchTime}秒</p>
          {queueError && <p className="text-sm text-destructive mb-2">{queueError}</p>}
          <Button variant="outline" onClick={async () => { await leaveQueue(); onBack(); }}>
            <XCircle className="w-4 h-4 mr-2" />取消匹配
          </Button>
        </div>
      </div>
    );
  }

  if (phase === "found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <Icon className={cn("w-20 h-20 mx-auto mb-4 animate-bounce", theme.accentText)} />
          <h2 className={cn("text-3xl font-gaming mb-2", theme.accentText)}>对手已找到！</h2>
          <p className="text-muted-foreground">准备战斗...</p>
        </div>
      </div>
    );
  }

  if (phase === "countdown") {
    const mkPlayerProfile = (p: any) => p ? {
      id: p.id, username: p.username, level: p.level,
      rank_tier: p.rank_tier, rank_stars: p.rank_stars,
      wins: p[theme.winsField], losses: p[theme.lossesField],
      avatar_url: p.avatar_url,
    } : null;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-8 mb-8">
            <PlayerBattleCard profile={mkPlayerProfile(profile)} variant="left" />
            <div className={cn("text-6xl font-gaming animate-pulse", theme.accentText)}>VS</div>
            <PlayerBattleCard profile={mkPlayerProfile(opponentProfile)} variant="right" />
          </div>
          <div className={cn("text-8xl font-gaming animate-bounce", theme.accentText)}>
            {countdown > 0 ? countdown : 'GO!'}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "battle" && matchData) {
    const currentWord = matchData.words[currentQuestion];
    const progressPercent = (currentQuestion / matchData.words.length) * 100;
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Badge variant="default">{profile.username}</Badge>
              <span className={cn("text-2xl font-gaming", theme.accentText)}>{myScoreDisplay}</span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className={cn("font-mono text-lg", timeLeft <= 30 && "text-destructive animate-pulse")}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-gaming text-neon-blue">{opponentScore}</span>
              <Badge variant="secondary">{opponentProfile?.username || '对手'}</Badge>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              第 {currentQuestion + 1}/{matchData.words.length} 题
            </span>
            {comboCount >= 2 && (
              <Badge variant="default" className="animate-pulse">
                <Zap className="w-3 h-3 mr-1" />{comboCount} 连击!
              </Badge>
            )}
          </div>
        </div>
        {currentWord && (
          <BattleQuizCard
            word={currentWord}
            quizType={quizType}
            options={options}
            wordOptions={wordOptions}
            onAnswer={handleAnswer}
            answerAnimation={answerAnimation}
            comboCount={comboCount}
          />
        )}
      </div>
    );
  }

  if (phase === "result") {
    const finalScore = myScoreRef.current;
    const winnerId = winnerIdRef.current;
    const isWinner = winnerId === profile.id;
    const isDraw = winnerId === null;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card variant="glow" className="max-w-md w-full p-8 text-center">
          {isDraw ? <Icon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            : isWinner ? <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
            : <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />}
          <h2 className="text-3xl font-gaming mb-2">
            {isDraw ? '平局！' : isWinner ? '胜利！' : '失败'}
          </h2>
          <div className="flex items-center justify-center gap-8 my-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{profile.username}</p>
              <p className={cn("text-4xl font-gaming", theme.accentText)}>{finalScore}</p>
            </div>
            <span className="text-2xl text-muted-foreground">:</span>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{opponentProfile?.username || '对手'}</p>
              <p className="text-4xl font-gaming text-neon-blue">{opponentScore}</p>
            </div>
          </div>
          <Button onClick={onBack} className="w-full" size="lg">返回</Button>
        </Card>
      </div>
    );
  }

  return null;
};

export default BattleArena;
