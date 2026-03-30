import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Swords, Loader2, Trophy, XCircle, Timer, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMatchQueue } from "@/hooks/useMatchQueue";
import { useEloSystem } from "@/hooks/useEloSystem";
import { useMatchSounds } from "@/hooks/useMatchSounds";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import BattleQuizCard, { BattleQuizType } from "./battle/BattleQuizCard";
import PlayerBattleCard from "./battle/PlayerBattleCard";
import { cancelPlayerStaleMatches } from "@/hooks/useMatchCleanup";
import { toast } from "sonner";

interface RankedBattleProps {
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

const RankedBattle = ({ onBack, initialMatchId, subject = "mixed" }: RankedBattleProps) => {
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

  const myScoreRef = useRef(0);
  const [myScoreDisplay, setMyScoreDisplay] = useState(0);
  const matchEndedRef = useRef(false);
  const answeringRef = useRef(false);
  const winnerIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);
  const isPlayer1Ref = useRef(false);

  // Generate quiz options
  const generateOptions = useCallback((words: Word[], currentIdx: number) => {
    const currentWord = words[currentIdx];
    if (!currentWord) return;

    const otherMeanings = words
      .filter((_, i) => i !== currentIdx)
      .map(w => w.meaning)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const meaningOpts = [...otherMeanings, currentWord.meaning].sort(() => Math.random() - 0.5);
    setOptions(meaningOpts);

    const otherWords = words
      .filter((_, i) => i !== currentIdx)
      .map(w => w.word)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    const wordOpts = [...otherWords, currentWord.word].sort(() => Math.random() - 0.5);
    setWordOptions(wordOpts);

    setQuizType(QUIZ_TYPES[currentIdx % QUIZ_TYPES.length]);
  }, []);

  // Load match data
  const loadMatch = useCallback(async (matchId: string) => {
    const { data: match } = await supabase
      .from('ranked_matches')
      .select('*')
      .eq('id', matchId)
      .single();

    if (!match || !profile) return;

    const words = (match.words as any[]) || [];
    isPlayer1Ref.current = match.player1_id === profile.id;
    
    setMatchData({
      ...match,
      words,
      player1_id: match.player1_id!,
      player2_id: match.player2_id!,
    });

    // Load opponent profile
    const opponentId = isPlayer1Ref.current ? match.player2_id : match.player1_id;
    const { data: opp } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', opponentId!)
      .single();
    setOpponentProfile(opp);

    if (words.length > 0) {
      generateOptions(words, 0);
    }

    // Subscribe to real-time score updates
    const channel = supabase
      .channel(`match-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'match_answers',
        filter: `match_id=eq.${matchId}`,
      }, (payload) => {
        const answer = payload.new as any;
        if (answer.player_id !== profile.id && answer.is_correct) {
          setOpponentScore(prev => prev + 1);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'ranked_matches',
        filter: `id=eq.${matchId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.winner_id) winnerIdRef.current = updated.winner_id;
        if (updated.status === 'completed' && !matchEndedRef.current) {
          matchEndedRef.current = true;
          setPhase("result");
        }
        if (isPlayer1Ref.current) {
          setOpponentScore(updated.player2_score);
        } else {
          setOpponentScore(updated.player1_score);
        }
      })
      .subscribe();

    channelRef.current = channel;
    setPhase("countdown");
  }, [profile, generateOptions]);

  // Match found handler
  const handleMatchFound = useCallback((matchId: string, _opponentId: string) => {
    sounds.playMatchFound();
    setPhase("found");
    setTimeout(() => loadMatch(matchId), 1000);
  }, [loadMatch, sounds]);

  // Match queue
  const { isSearching, joinQueue, leaveQueue } = useMatchQueue({
    profileId: profile?.id || null,
    grade: profile?.grade || 7,
    matchType: 'ranked',
    eloRating: profile?.elo_rating || 1000,
    enabled: !!profile,
    subject,
    onMatchFound: handleMatchFound,
  });

  // Start searching
  useEffect(() => {
    if (!profile) return;

    if (initialMatchId) {
      loadMatch(initialMatchId);
    } else {
      // Clean stale matches first
      cancelPlayerStaleMatches(profile.id, profile.grade).then(() => {
        joinQueue();
      });
    }

    return () => {
      leaveQueue();
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [profile?.id]);

  // Search timer
  useEffect(() => {
    if (phase !== "searching") return;
    const interval = setInterval(() => setSearchTime(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // Countdown
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      setPhase("battle");
      // Start battle timer
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            endMatch();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }
    const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, countdown]);

  // Handle answer
  const handleAnswer = useCallback(async (isCorrect: boolean) => {
    if (!matchData || !profile || matchEnded) return;

    const newScore = isCorrect ? myScore + 1 : myScore;
    const newCombo = isCorrect ? comboCount + 1 : 0;
    
    setMyScore(newScore);
    setComboCount(newCombo);
    setAnswerAnimation(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => setAnswerAnimation(null), 500);

    // Record answer
    await supabase.from('match_answers').insert({
      match_id: matchData.id,
      player_id: profile.id,
      question_index: currentQuestion,
      answer: isCorrect ? 'correct' : 'wrong',
      is_correct: isCorrect,
    });

    // Update match score
    const scoreField = isPlayer1Ref.current ? 'player1_score' : 'player2_score';
    await supabase
      .from('ranked_matches')
      .update({ [scoreField]: newScore })
      .eq('id', matchData.id);

    // Next question
    const nextQ = currentQuestion + 1;
    if (nextQ >= matchData.words.length) {
      endMatch();
    } else {
      setCurrentQuestion(nextQ);
      generateOptions(matchData.words, nextQ);
    }
  }, [matchData, profile, currentQuestion, myScore, comboCount, matchEnded, generateOptions]);

  // End match
  const endMatch = useCallback(async () => {
    if (!matchData || !profile || matchEnded) return;
    setMatchEnded(true);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Determine winner
    const finalMyScore = myScore;
    let winnerId: string | null = null;
    
    // Wait a moment for final scores to sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get final match state
    const { data: finalMatch } = await supabase
      .from('ranked_matches')
      .select('*')
      .eq('id', matchData.id)
      .single();

    if (finalMatch) {
      const p1Score = isPlayer1Ref.current ? finalMyScore : finalMatch.player1_score;
      const p2Score = isPlayer1Ref.current ? finalMatch.player2_score : finalMyScore;
      
      if (p1Score > p2Score) winnerId = finalMatch.player1_id;
      else if (p2Score > p1Score) winnerId = finalMatch.player2_id;
    }

    // Update match
    await supabase
      .from('ranked_matches')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        winner_id: winnerId,
        [isPlayer1Ref.current ? 'player1_score' : 'player2_score']: finalMyScore,
      })
      .eq('id', matchData.id);

    // Update ELO
    const opponentElo = opponentProfile?.elo_rating || 1000;
    const playerWon = winnerId === profile.id;
    const isDraw = winnerId === null;
    
    await updateEloAfterMatch(
      profile.id,
      profile.elo_rating,
      opponentElo,
      playerWon,
      isDraw,
      false,
      false
    );

    // Update win/loss
    if (playerWon) {
      await supabase
        .from('profiles')
        .update({ wins: (profile.wins || 0) + 1 })
        .eq('id', profile.id);
      sounds.playVictory();
    } else if (!isDraw) {
      await supabase
        .from('profiles')
        .update({ losses: (profile.losses || 0) + 1 })
        .eq('id', profile.id);
      sounds.playDefeat();
    }

    setPhase("result");
  }, [matchData, profile, myScore, opponentProfile, matchEnded, updateEloAfterMatch, sounds]);

  // Handle cancel
  const handleCancel = async () => {
    await leaveQueue();
    onBack();
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <Swords className="w-16 h-16 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">请先登录</h2>
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />返回
          </Button>
        </div>
      </div>
    );
  }

  // Searching phase
  if (phase === "searching") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="relative mb-8">
            <Swords className="w-20 h-20 text-primary mx-auto animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-gaming mb-2">正在匹配对手...</h2>
          <p className="text-muted-foreground mb-2">
            排位赛 · {profile.grade}年级 · ELO {profile.elo_rating}
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            搜索时间: {searchTime}秒
          </p>
          <Button variant="outline" onClick={handleCancel}>
            <XCircle className="w-4 h-4 mr-2" />取消匹配
          </Button>
        </div>
      </div>
    );
  }

  // Found phase
  if (phase === "found") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <Swords className="w-20 h-20 text-primary mx-auto mb-4 animate-bounce" />
          <h2 className="text-3xl font-gaming text-primary mb-2">对手已找到！</h2>
          <p className="text-muted-foreground">准备战斗...</p>
        </div>
      </div>
    );
  }

  // Countdown phase
  if (phase === "countdown") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-8 mb-8">
            <PlayerBattleCard
              profile={profile ? {
                id: profile.id,
                username: profile.username,
                level: profile.level,
                rank_tier: profile.rank_tier,
                rank_stars: profile.rank_stars,
                wins: profile.wins,
                losses: profile.losses,
                avatar_url: profile.avatar_url,
              } : null}
              variant="left"
            />
            <div className="text-6xl font-gaming text-primary animate-pulse">VS</div>
            <PlayerBattleCard
              profile={opponentProfile ? {
                id: opponentProfile.id,
                username: opponentProfile.username,
                level: opponentProfile.level,
                rank_tier: opponentProfile.rank_tier,
                rank_stars: opponentProfile.rank_stars,
                wins: opponentProfile.wins,
                losses: opponentProfile.losses,
                avatar_url: opponentProfile.avatar_url,
              } : null}
              variant="right"
            />
          </div>
          <div className="text-8xl font-gaming text-primary animate-bounce">
            {countdown > 0 ? countdown : 'GO!'}
          </div>
        </div>
      </div>
    );
  }

  // Battle phase
  if (phase === "battle" && matchData) {
    const currentWord = matchData.words[currentQuestion];
    const progressPercent = ((currentQuestion) / matchData.words.length) * 100;

    return (
      <div className="min-h-screen bg-background p-4">
        {/* Top bar */}
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
                <Zap className="w-3 h-3 mr-1" />
                {comboCount} 连击!
              </Badge>
            )}
          </div>
        </div>

        {/* Quiz */}
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

  // Result phase
  if (phase === "result") {
    const isWinner = matchData?.winner_id === profile.id;
    const isDraw = !matchData?.winner_id;

    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card variant="glow" className="max-w-md w-full p-8 text-center">
          {isDraw ? (
            <Swords className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          ) : isWinner ? (
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
          ) : (
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          )}
          
          <h2 className="text-3xl font-gaming mb-2">
            {isDraw ? '平局！' : isWinner ? '胜利！' : '失败'}
          </h2>

          <div className="flex items-center justify-center gap-8 my-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{profile.username}</p>
              <p className="text-4xl font-gaming text-primary">{myScore}</p>
            </div>
            <span className="text-2xl text-muted-foreground">:</span>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{opponentProfile?.username || '对手'}</p>
              <p className="text-4xl font-gaming text-neon-blue">{opponentScore}</p>
            </div>
          </div>

          <Button onClick={onBack} className="w-full" size="lg">
            返回
          </Button>
        </Card>
      </div>
    );
  }

  return null;
};

export default RankedBattle;
