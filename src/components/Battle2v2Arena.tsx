import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Trophy, XCircle, Timer, Zap, Swords } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMatchSounds } from "@/hooks/useMatchSounds";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import BattleQuizCard, { BattleQuizType } from "./battle/BattleQuizCard";
import PlayerBattleCard from "./battle/PlayerBattleCard";
import { KillStreakBanner } from "./battle/KillStreakBanner";

interface Word { id: string; word: string; meaning: string; phonetic?: string | null; example?: string | null; }
interface MatchData {
  id: string;
  player1_id: string; player2_id: string;
  player3_id: string | null; player4_id: string | null;
  team1_score: number; team2_score: number;
  words: Word[]; status: string; grade: number;
  winner_team: number | null;
}

type Phase = "searching" | "found" | "countdown" | "battle" | "result";
const QUIZ_TYPES: BattleQuizType[] = ["meaning", "reverse", "spelling", "listening"];

interface Props {
  onBack: () => void;
  subject?: string;
  partyId?: string | null;
  initialMatchId?: string | null;
}

const Battle2v2Arena = ({ onBack, subject = "mixed", partyId = null, initialMatchId = null }: Props) => {
  const { profile } = useAuth();
  const sounds = useMatchSounds();

  const [phase, setPhase] = useState<Phase>(initialMatchId ? "found" : "searching");
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [team1Profiles, setTeam1Profiles] = useState<any[]>([]);
  const [team2Profiles, setTeam2Profiles] = useState<any[]>([]);
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
  const [searchTime, setSearchTime] = useState(0);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [rewards, setRewards] = useState<{ coins: number; xp: number } | null>(null);

  const matchEndedRef = useRef(false);
  const answeringRef = useRef(false);
  const onTeam1Ref = useRef(false);
  const winnerTeamRef = useRef<number | null>(null);
  const channelRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const queuePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateOptions = useCallback((words: Word[], idx: number) => {
    const cur = words[idx]; if (!cur) return;
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
    const team1Ids = [match.player1_id, match.player3_id].filter(Boolean) as string[];
    const team2Ids = [match.player2_id, match.player4_id].filter(Boolean) as string[];
    onTeam1Ref.current = team1Ids.includes(profile.id);
    setMatchData({ ...match, words } as any);
    setTeam1Score(match.team1_score ?? 0);
    setTeam2Score(match.team2_score ?? 0);

    const { data: profs } = await supabase.from('profiles').select('*').in('id', [...team1Ids, ...team2Ids]);
    setTeam1Profiles(team1Ids.map(id => profs?.find(p => p.id === id)).filter(Boolean));
    setTeam2Profiles(team2Ids.map(id => profs?.find(p => p.id === id)).filter(Boolean));

    if (words.length > 0) generateOptions(words, 0);

    const channel = supabase.channel(`match2v2-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ranked_matches', filter: `id=eq.${matchId}` }, (payload) => {
        const u = payload.new as any;
        setTeam1Score(u.team1_score ?? 0);
        setTeam2Score(u.team2_score ?? 0);
        if (u.winner_team !== null && u.winner_team !== undefined) winnerTeamRef.current = u.winner_team;
        if (u.status === 'completed' && !matchEndedRef.current) {
          matchEndedRef.current = true; setPhase("result");
        }
      })
      .subscribe();
    channelRef.current = channel;

    // Fallback polling
    pollRef.current = window.setInterval(async () => {
      if (matchEndedRef.current) return;
      const { data: m } = await supabase.from('ranked_matches')
        .select('team1_score, team2_score, status, winner_team').eq('id', matchId).single();
      if (!m) return;
      setTeam1Score(prev => (m.team1_score ?? 0) > prev ? m.team1_score! : prev);
      setTeam2Score(prev => (m.team2_score ?? 0) > prev ? m.team2_score! : prev);
      if (m.winner_team !== null && m.winner_team !== undefined) winnerTeamRef.current = m.winner_team;
      if (m.status === 'completed' && !matchEndedRef.current) {
        matchEndedRef.current = true; setPhase("result");
      }
    }, 2000);

    setPhase("countdown");
  }, [profile, generateOptions]);

  const tryFindMatch = useCallback(async () => {
    if (!profile) return null;
    const args: any = {
      _profile_id: profile.id,
      _grade: profile.grade,
      _elo_rating: (profile as any).elo_rating ?? 1000,
      _subject: subject,
    };
    if (partyId) args._party_id = partyId;
    const { data, error } = await supabase.rpc('find_match_2v2', args);
    if (error) { setQueueError(error.message); return null; }
    return data as string | null;
  }, [profile, subject, partyId]);

  useEffect(() => {
    if (!profile) return;
    if (initialMatchId) { loadMatch(initialMatchId); return; }

    let mounted = true;
    (async () => {
      const mid = await tryFindMatch();
      if (!mounted) return;
      if (mid) { sounds.playMatchFound(); setPhase("found"); setTimeout(() => loadMatch(mid), 800); return; }

      // Poll queue for match
      queuePollRef.current = window.setInterval(async () => {
        if (!mounted || matchEndedRef.current) return;
        const { data: q } = await supabase.from('match_queue')
          .select('status, match_id')
          .eq('profile_id', profile.id).eq('mode', '2v2')
          .eq('status', 'matched').order('created_at', { ascending: false }).limit(1);
        if (q && q[0]?.match_id) {
          if (queuePollRef.current) clearInterval(queuePollRef.current);
          sounds.playMatchFound(); setPhase("found");
          setTimeout(() => loadMatch(q[0].match_id!), 800);
          return;
        }
        await tryFindMatch();
      }, 3000);
    })();

    return () => {
      mounted = false;
      if (queuePollRef.current) clearInterval(queuePollRef.current);
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      // Leave queue if abandoning
      supabase.from('match_queue').delete()
        .eq('profile_id', profile.id).eq('mode', '2v2').eq('status', 'searching');
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
      else if (data) {
        winnerTeamRef.current = data.winnerTeam ?? null;
        if (typeof data.coinsEarned === 'number' && typeof data.xpEarned === 'number') {
          setRewards({ coins: data.coinsEarned, xp: data.xpEarned });
        }
      }
    } catch (e) { console.error(e); }
    const wt = winnerTeamRef.current;
    if (wt && (wt === (onTeam1Ref.current ? 1 : 2))) sounds.playVictory();
    else if (wt !== null) sounds.playDefeat();
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
      let serverCorrect = clientCorrect;
      let matchEnded = false;
      try {
        const { data, error } = await supabase.functions.invoke('submit-answer', {
          body: { matchId: matchData.id, questionIndex: idx, answer, quizType },
        });
        if (error) {
          const ctx: any = (error as any).context;
          if (ctx?.status === 409 || /Match ended/i.test(String((error as any).message || ''))) matchEnded = true;
        } else if (data?.matchEnded) matchEnded = true;
        else if (data && !data.error) serverCorrect = !!data.isCorrect;
      } catch (_) { /* network hiccup */ }
      if (matchEnded) { endMatch(); return; }

      setComboCount(prev => serverCorrect ? prev + 1 : 0);
      setAnswerAnimation(serverCorrect ? 'correct' : 'wrong');
      setTimeout(() => setAnswerAnimation(null), 500);
      const next = idx + 1;
      if (next >= matchData.words.length) endMatch();
      else { setCurrentQuestion(next); generateOptions(matchData.words, next); }
    } finally { answeringRef.current = false; }
  }, [matchData, profile, currentQuestion, quizType, generateOptions, endMatch]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <Swords className="w-16 h-16 mx-auto mb-4 text-primary" />
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
            <Swords className="w-20 h-20 mx-auto animate-pulse text-primary" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-gaming mb-2">2v2 匹配中...</h2>
          <p className="text-muted-foreground mb-2">
            排位赛 · {profile.grade}年级 · ELO {(profile as any).elo_rating ?? 1000}
          </p>
          <p className="text-sm text-muted-foreground mb-2">{partyId ? "双排组队 · " : "单排 · "}搜索时间: {searchTime}秒</p>
          {queueError && <p className="text-sm text-destructive mb-2">{queueError}</p>}
          <Button variant="outline" onClick={async () => {
            await supabase.from('match_queue').delete()
              .eq('profile_id', profile.id).eq('mode', '2v2').eq('status', 'searching');
            onBack();
          }}>
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
          <Swords className="w-20 h-20 mx-auto mb-4 animate-bounce text-primary" />
          <h2 className="text-3xl font-gaming mb-2 text-primary">4 人已就位！</h2>
          <p className="text-muted-foreground">准备战斗...</p>
        </div>
      </div>
    );
  }

  const mkPlayerProfile = (p: any) => p ? {
    id: p.id, username: p.username, level: p.level,
    rank_tier: p.rank_tier, rank_stars: p.rank_stars,
    wins: p.wins, losses: p.losses, avatar_url: p.avatar_url,
  } : null;

  if (phase === "countdown") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-4 mb-8 flex-wrap">
            <div className="flex gap-2">
              {team1Profiles.map(p => <PlayerBattleCard key={p.id} profile={mkPlayerProfile(p)} variant="left" className="max-w-[180px]" />)}
            </div>
            <div className="text-5xl font-gaming animate-pulse text-primary">VS</div>
            <div className="flex gap-2">
              {team2Profiles.map(p => <PlayerBattleCard key={p.id} profile={mkPlayerProfile(p)} variant="right" className="max-w-[180px]" />)}
            </div>
          </div>
          <div className="text-8xl font-gaming animate-bounce text-primary">
            {countdown > 0 ? countdown : 'GO!'}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "battle" && matchData) {
    const currentWord = matchData.words[currentQuestion];
    const progressPercent = (currentQuestion / matchData.words.length) * 100;
    const myTeamScore = onTeam1Ref.current ? team1Score : team2Score;
    const oppTeamScore = onTeam1Ref.current ? team2Score : team1Score;
    const myTeam = onTeam1Ref.current ? team1Profiles : team2Profiles;
    const oppTeam = onTeam1Ref.current ? team2Profiles : team1Profiles;
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto mb-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex flex-col gap-0.5 truncate">
                {myTeam.map(p => <Badge key={p.id} variant="default" className="text-[10px] truncate">{p.username}</Badge>)}
              </div>
              <span className="text-2xl font-gaming text-primary">{myTeamScore}</span>
            </div>
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-muted-foreground" />
              <span className={cn("font-mono text-lg", timeLeft <= 30 && "text-destructive animate-pulse")}>
                {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
              <span className="text-2xl font-gaming text-neon-blue">{oppTeamScore}</span>
              <div className="flex flex-col gap-0.5 truncate">
                {oppTeam.map(p => <Badge key={p.id} variant="secondary" className="text-[10px] truncate">{p.username}</Badge>)}
              </div>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">第 {currentQuestion + 1}/{matchData.words.length} 题</span>
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
            onAnswer={handleAnswer} answerAnimation={answerAnimation} comboCount={comboCount} />
        )}
      </div>
    );
  }

  if (phase === "result") {
    const wt = winnerTeamRef.current;
    const isDraw = wt === null;
    const isWinner = wt !== null && wt === (onTeam1Ref.current ? 1 : 2);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card variant="glow" className="max-w-md w-full p-8 text-center">
          {isDraw ? <Swords className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            : isWinner ? <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
            : <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />}
          <h2 className="text-3xl font-gaming mb-2">
            {isDraw ? '平局！' : isWinner ? '团队胜利！' : '团队失败'}
          </h2>
          <div className="flex items-center justify-center gap-8 my-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">我方</p>
              <p className="text-4xl font-gaming text-primary">{onTeam1Ref.current ? team1Score : team2Score}</p>
            </div>
            <span className="text-2xl text-muted-foreground">:</span>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">对方</p>
              <p className="text-4xl font-gaming text-neon-blue">{onTeam1Ref.current ? team2Score : team1Score}</p>
            </div>
          </div>
          {rewards && (
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="px-4 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-gaming">
                +{rewards.coins} 狄邦豆
              </div>
              <div className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 font-gaming">
                +{rewards.xp} EXP
              </div>
            </div>
          )}
          <Button onClick={onBack} className="w-full" size="lg">返回</Button>
        </Card>
      </div>
    );
  }

  return null;
};

export default Battle2v2Arena;
