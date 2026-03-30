import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Globe, Trophy, XCircle, Timer, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMatchQueue } from "@/hooks/useMatchQueue";
import { useEloSystem } from "@/hooks/useEloSystem";
import { useMatchSounds } from "@/hooks/useMatchSounds";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import BattleQuizCard, { BattleQuizType } from "./battle/BattleQuizCard";
import PlayerBattleCard from "./battle/PlayerBattleCard";
import { cancelPlayerStaleMatches } from "@/hooks/useMatchCleanup";

interface FreeMatchBattleProps {
  onBack: () => void;
  initialMatchId?: string | null;
  subject?: string;
}

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

const FreeMatchBattle = ({ onBack, initialMatchId, subject = "mixed" }: FreeMatchBattleProps) => {
  const { profile } = useAuth();
  const { updateEloAfterMatch } = useEloSystem();
  const sounds = useMatchSounds();

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

  // Use refs for values accessed in callbacks to avoid stale closures
  const myScoreRef = useRef(0);
  const [myScoreDisplay, setMyScoreDisplay] = useState(0);
  const matchEndedRef = useRef(false);
  const answeringRef = useRef(false); // guard against double-answering
  const winnerIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);
  const isPlayer1Ref = useRef(false);

  const generateOptions = useCallback((words: Word[], currentIdx: number) => {
    const currentWord = words[currentIdx];
    if (!currentWord) return;
    const otherMeanings = words.filter((_, i) => i !== currentIdx).map(w => w.meaning).sort(() => Math.random() - 0.5).slice(0, 3);
    setOptions([...otherMeanings, currentWord.meaning].sort(() => Math.random() - 0.5));
    const otherWords = words.filter((_, i) => i !== currentIdx).map(w => w.word).sort(() => Math.random() - 0.5).slice(0, 3);
    setWordOptions([...otherWords, currentWord.word].sort(() => Math.random() - 0.5));
    setQuizType(QUIZ_TYPES[currentIdx % QUIZ_TYPES.length]);
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
        const answer = payload.new as any;
        if (answer.player_id !== profile.id && answer.is_correct) setOpponentScore(prev => prev + 1);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ranked_matches', filter: `id=eq.${matchId}` }, (payload) => {
        const updated = payload.new as any;
        if (updated.status === 'completed' && !matchEndedRef.current) {
          matchEndedRef.current = true;
          setPhase("result");
        }
        if (isPlayer1Ref.current) setOpponentScore(updated.player2_score);
        else setOpponentScore(updated.player1_score);
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
    matchType: 'free',
    eloRating: profile?.elo_free || 1000,
    enabled: !!profile,
    subject,
    onMatchFound: handleMatchFound,
  });

  useEffect(() => {
    if (!profile) return;
    if (initialMatchId) { loadMatch(initialMatchId); }
    else { cancelPlayerStaleMatches(profile.id, profile.grade).then(() => joinQueue()); }
    return () => {
      leaveQueue();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [profile?.id]);

  useEffect(() => {
    if (phase !== "searching") return;
    const interval = setInterval(() => setSearchTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("battle");
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => { if (prev <= 1) { endMatch(); return 0; } return prev - 1; });
      }, 1000);
      return;
    }
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  const endMatch = useCallback(async () => {
    if (!profile || matchEndedRef.current) return;
    matchEndedRef.current = true;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    // Small delay to let last answer sync
    await new Promise(resolve => setTimeout(resolve, 500));

    const { data: finalMatch } = await supabase.from('ranked_matches').select('*').eq('id', matchData?.id).single();
    if (!finalMatch) { setPhase("result"); return; }

    const currentScore = myScoreRef.current;
    const p1Score = isPlayer1Ref.current ? currentScore : finalMatch.player1_score;
    const p2Score = isPlayer1Ref.current ? finalMatch.player2_score : currentScore;

    let winnerId: string | null = null;
    if (p1Score > p2Score) winnerId = finalMatch.player1_id;
    else if (p2Score > p1Score) winnerId = finalMatch.player2_id;

    // Only player1 writes the final result to avoid race condition
    if (isPlayer1Ref.current) {
      await supabase.from('ranked_matches').update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        winner_id: winnerId,
        player1_score: currentScore,
      }).eq('id', finalMatch.id);
    } else {
      // Player2 only updates their own score
      await supabase.from('ranked_matches').update({
        player2_score: currentScore,
      }).eq('id', finalMatch.id);
      // Wait a bit for player1 to finalize
      await new Promise(resolve => setTimeout(resolve, 1500));
      // Re-read to get the final state
      const { data: recheck } = await supabase.from('ranked_matches').select('*').eq('id', finalMatch.id).single();
      if (recheck && recheck.status !== 'completed') {
        // Player1 didn't finalize yet, player2 takes over
        await supabase.from('ranked_matches').update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          winner_id: winnerId,
        }).eq('id', finalMatch.id);
      }
    }

    const playerWon = winnerId === profile.id;
    const isDraw = winnerId === null;
    await updateEloAfterMatch(profile.id, profile.elo_free, opponentProfile?.elo_free || 1000, playerWon, isDraw, false, true);

    if (playerWon) {
      await supabase.from('profiles').update({ free_match_wins: (profile.free_match_wins || 0) + 1 }).eq('id', profile.id);
      sounds.playVictory();
    } else if (!isDraw) {
      await supabase.from('profiles').update({ free_match_losses: (profile.free_match_losses || 0) + 1 }).eq('id', profile.id);
      sounds.playDefeat();
    }
    setPhase("result");
  }, [matchData, profile, opponentProfile, updateEloAfterMatch, sounds]);

  const handleAnswer = useCallback(async (isCorrect: boolean) => {
    if (!matchData || !profile || matchEndedRef.current || answeringRef.current) return;
    answeringRef.current = true;

    try {
      const newScore = isCorrect ? myScoreRef.current + 1 : myScoreRef.current;
      myScoreRef.current = newScore;
      setMyScoreDisplay(newScore);
      setComboCount(prev => isCorrect ? prev + 1 : 0);
      setAnswerAnimation(isCorrect ? 'correct' : 'wrong');
      setTimeout(() => setAnswerAnimation(null), 500);

      // Fire DB writes in parallel
      await Promise.all([
        supabase.from('match_answers').insert({
          match_id: matchData.id,
          player_id: profile.id,
          question_index: currentQuestion,
          answer: isCorrect ? 'correct' : 'wrong',
          is_correct: isCorrect,
        }),
        supabase.from('ranked_matches').update({
          [isPlayer1Ref.current ? 'player1_score' : 'player2_score']: newScore,
        }).eq('id', matchData.id),
      ]);

      const nextQ = currentQuestion + 1;
      if (nextQ >= matchData.words.length) {
        endMatch();
      } else {
        setCurrentQuestion(nextQ);
        generateOptions(matchData.words, nextQ);
      }
    } finally {
      answeringRef.current = false;
    }
  }, [matchData, profile, currentQuestion, generateOptions, endMatch]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center"><Globe className="w-16 h-16 text-primary mx-auto mb-4" /><h2 className="text-2xl font-bold mb-4">请先登录</h2><Button variant="outline" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-2" />返回</Button></div>
      </div>
    );
  }

  if (phase === "searching") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="relative mb-8">
            <Globe className="w-20 h-20 text-neon-cyan mx-auto animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-neon-cyan/30 border-t-neon-cyan animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-gaming mb-2">自由匹配中...</h2>
          <p className="text-muted-foreground mb-2">自由服 · ELO {profile.elo_free}</p>
          <p className="text-sm text-muted-foreground mb-2">搜索时间: {searchTime}秒</p>
          {queueError && <p className="text-sm text-destructive mb-2">{queueError}</p>}
          <Button variant="outline" onClick={async () => { await leaveQueue(); onBack(); }}><XCircle className="w-4 h-4 mr-2" />取消匹配</Button>
        </div>
      </div>
    );
  }

  if (phase === "found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center"><Globe className="w-20 h-20 text-neon-cyan mx-auto mb-4 animate-bounce" /><h2 className="text-3xl font-gaming text-neon-cyan mb-2">对手已找到！</h2></div>
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-8 mb-8">
            <PlayerBattleCard profile={profile ? { id: profile.id, username: profile.username, level: profile.level, rank_tier: profile.rank_tier, rank_stars: profile.rank_stars, wins: profile.free_match_wins, losses: profile.free_match_losses, avatar_url: profile.avatar_url } : null} variant="left" />
            <div className="text-6xl font-gaming text-neon-cyan animate-pulse">VS</div>
            <PlayerBattleCard profile={opponentProfile ? { id: opponentProfile.id, username: opponentProfile.username, level: opponentProfile.level, rank_tier: opponentProfile.rank_tier, rank_stars: opponentProfile.rank_stars, wins: opponentProfile.free_match_wins, losses: opponentProfile.free_match_losses, avatar_url: opponentProfile.avatar_url } : null} variant="right" />
          </div>
          <div className="text-8xl font-gaming text-neon-cyan animate-bounce">{countdown > 0 ? countdown : 'GO!'}</div>
        </div>
      </div>
    );
  }

  if (phase === "battle" && matchData) {
    const currentWord = matchData.words[currentQuestion];
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><Badge variant="default">{profile.username}</Badge><span className="text-2xl font-gaming text-neon-cyan">{myScoreDisplay}</span></div>
            <div className="flex items-center gap-2"><Timer className="w-4 h-4" /><span className={cn("font-mono text-lg", timeLeft <= 30 && "text-destructive animate-pulse")}>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span></div>
            <div className="flex items-center gap-2"><span className="text-2xl font-gaming text-neon-blue">{opponentScore}</span><Badge variant="secondary">{opponentProfile?.username || '对手'}</Badge></div>
          </div>
          <Progress value={((currentQuestion) / matchData.words.length) * 100} className="h-2" />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">第 {currentQuestion + 1}/{matchData.words.length} 题</span>
            {comboCount >= 2 && <Badge variant="default" className="animate-pulse"><Zap className="w-3 h-3 mr-1" />{comboCount} 连击!</Badge>}
          </div>
        </div>
        {currentWord && <BattleQuizCard word={currentWord} quizType={quizType} options={options} wordOptions={wordOptions} onAnswer={handleAnswer} answerAnimation={answerAnimation} comboCount={comboCount} />}
      </div>
    );
  }

  if (phase === "result") {
    const finalScore = myScoreRef.current;
    const isWinner = matchData?.winner_id === profile.id;
    const isDraw = !matchData?.winner_id;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card variant="glow" className="max-w-md w-full p-8 text-center">
          {isDraw ? <Globe className="w-16 h-16 text-muted-foreground mx-auto mb-4" /> : isWinner ? <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" /> : <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />}
          <h2 className="text-3xl font-gaming mb-2">{isDraw ? '平局！' : isWinner ? '胜利！' : '失败'}</h2>
          <div className="flex items-center justify-center gap-8 my-6">
            <div className="text-center"><p className="text-sm text-muted-foreground">{profile.username}</p><p className="text-4xl font-gaming text-neon-cyan">{finalScore}</p></div>
            <span className="text-2xl text-muted-foreground">:</span>
            <div className="text-center"><p className="text-sm text-muted-foreground">{opponentProfile?.username || '对手'}</p><p className="text-4xl font-gaming text-neon-blue">{opponentScore}</p></div>
          </div>
          <Button onClick={onBack} className="w-full" size="lg">返回</Button>
        </Card>
      </div>
    );
  }

  return null;
};

export default FreeMatchBattle;
