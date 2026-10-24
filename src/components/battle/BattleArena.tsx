import { DacCheaterNotice } from "@/components/battle/DacCheaterNotice";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, Trophy, XCircle, Timer, Zap, LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMatchQueue } from "@/hooks/useMatchQueue";
import { useMatchSounds } from "@/hooks/useMatchSounds";
import SoundVariantSwitcher from "./SoundVariantSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import ServerBattleQuizCard from "@/components/battle/ServerBattleQuizCard";
import { useServerBattleQuestion } from "@/hooks/useServerBattleQuestion";
import { BattleAnswerResult, submitBattleAnswer } from "@/lib/serverBattle";
import PlayerBattleCard from "./PlayerBattleCard";
import KillStreakBanner from "./KillStreakBanner";
import DacBadge from "./DacBadge";
import NameCardFx, { nameCardFxClass, nameCardFxStyle } from "@/components/NameCardFx";
import { getNameCardGradientStyle } from "@/components/profile-card/utils";
import { rarityColors, rarityLabels, NameCardData } from "@/components/profile-card/constants";
import { BadgeIcon } from "@/components/ui/badge-icon";
import { remainingBattleSeconds } from "@/lib/battleClock";
import { boundedRequest } from "@/lib/boundedRequest";
import { matchBots, tickMatchBots, botPlayer } from "@/lib/matchmaking";

interface MatchData {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_score: number;
  player2_score: number;
  question_count: number;
  status: string;
  grade: number;
  started_at: string;
  winner_id: string | null;
  winner_team?: number | null;
}

type BattlePhase = "searching" | "found" | "loading" | "countdown" | "battle" | "result";



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
  const { profile, refreshProfile } = useAuth();
  const sounds = useMatchSounds();
  const Icon = theme.Icon;

  const [phase, setPhase] = useState<BattlePhase>(initialMatchId ? "found" : "searching");
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [isBotMatch, setIsBotMatch] = useState(false);
  const botMatchRef = useRef(false);
  const [botOutcome, setBotOutcome] = useState<number | null>(null);
  const [matchLoadError, setMatchLoadError] = useState<string | null>(null);
  const loadingMatchIdRef = useRef<string | null>(initialMatchId ?? null);
  const { question, questionError, questionLoading, loadQuestion } = useServerBattleQuestion(matchData?.id);
  const [opponentProfile, setOpponentProfile] = useState<any>(null);
  const [opponentNameCard, setOpponentNameCard] = useState<NameCardData | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [answerAnimation, setAnswerAnimation] = useState<'correct' | 'wrong' | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(300);
  const [searchTime, setSearchTime] = useState(0);

  const myScoreRef = useRef(0);
  const [myScoreDisplay, setMyScoreDisplay] = useState(0);
  const matchEndedRef = useRef(false);
  const answeringRef = useRef(false);
  const gradedQuestionsRef = useRef(new Set<number>());
  const [answerHealthy, setAnswerHealthy] = useState(true);
  const winnerIdRef = useRef<string | null>(null);
  const [rewards, setRewards] = useState<{ coins: number; xp: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPlayer1Ref = useRef(false);
  // DAC：记录当前题目展示时间，用于答题速度检测
  const questionShownAtRef = useRef(Date.now());

  const loadMatch = useCallback(async (matchId: string, showIntel = true) => {
    loadingMatchIdRef.current = matchId;
    setMatchLoadError(null);
    try {
    const { data: match } = await boundedRequest(supabase.from('ranked_matches').select('*').eq('id', matchId).single());
    if (!match || !profile) throw new Error("对局加载失败，请重试");
    isPlayer1Ref.current = match.player1_id === profile.id;
    const bots = await matchBots(matchId);
    botMatchRef.current = !!bots;
    setIsBotMatch(!!bots);
    if (!match.player1_id || (!match.player2_id && !bots)) throw new Error("对局加载失败，请重试");
    setMatchData({ ...match, player1_id: match.player1_id, player2_id: match.player2_id ?? 'bot-2' });
    myScoreRef.current = isPlayer1Ref.current ? match.player1_score : match.player2_score;
    setMyScoreDisplay(myScoreRef.current);
    setOpponentScore(isPlayer1Ref.current ? match.player2_score : match.player1_score);
    setTimeLeft(remainingBattleSeconds(match.started_at));
    const opponentId = isPlayer1Ref.current ? match.player2_id : match.player1_id;
    const opp = bots ? botPlayer(2) : (await boundedRequest(supabase.from('profiles').select('*').eq('id', opponentId ?? '').single())).data;
    setOpponentProfile(opp);

    // 预讯过场：拉取对手佩戴的名片
    if (showIntel && opponentId) {
      const { data: cardRows } = await boundedRequest(supabase
        .from('user_name_cards')
        .select('rank_position, name_cards (id, name, description, background_gradient, icon, category, rarity)')
        .eq('profile_id', opponentId)
        .eq('is_equipped', true)
        .limit(1));
      const row: any = cardRows?.[0];
      if (row?.name_cards) {
        setOpponentNameCard({ ...row.name_cards, rank_position: row.rank_position, is_equipped: true, is_owned: true });
      }
    }


    const channel = supabase.channel(`match-${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ranked_matches', filter: `id=eq.${matchId}` }, (payload) => {
        const u = payload.new as any;
        if (u.winner_id) winnerIdRef.current = u.winner_id;
        if (botMatchRef.current && u.status === 'completed') setBotOutcome(u.winner_team);
        if (u.status === 'completed' && !matchEndedRef.current) {
          matchEndedRef.current = true;
          setPhase("result");
        }
        setOpponentScore(isPlayer1Ref.current ? u.player2_score : u.player1_score);
      })
      .subscribe();
    channelRef.current = channel;

    // 兜底：实时事件可能丢失，定期回拉对方分数与比赛状态
    const pollId = window.setInterval(async () => {
      if (matchEndedRef.current) return;
      if (botMatchRef.current) await tickMatchBots(matchId).catch(() => {});
      const { data: m } = await supabase
        .from('ranked_matches')
        .select('player1_score, player2_score, status, winner_id, winner_team')
        .eq('id', matchId)
        .single();
      if (!m) return;
      const oppScore = isPlayer1Ref.current ? m.player2_score : m.player1_score;
      setOpponentScore(oppScore);
      if (m.winner_id) winnerIdRef.current = m.winner_id;
      if (botMatchRef.current && m.status === 'completed') setBotOutcome(m.winner_team);
      if (m.status === 'completed' && !matchEndedRef.current) {
        matchEndedRef.current = true;
        setPhase("result");
      }
    }, 2000);
    pollRef.current = pollId;

    if (showIntel) {
      setPhase("loading");
      setTimeout(() => { if (!matchEndedRef.current) setPhase("countdown"); }, 6000);
    } else {
      setPhase("countdown");
    }
    } catch { setMatchLoadError("对局加载失败，请重试"); setPhase("found"); }
  }, [profile]);

  const handleMatchFound = useCallback((matchId: string) => {
    sounds.playMatchFound();
    setPhase("found");
    setTimeout(() => loadMatch(matchId, true), 1000);
  }, [loadMatch, sounds]);

  const { joinQueue, leaveQueue, isSearching, error: queueError } = useMatchQueue({
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
    let mounted = true;
    if (initialMatchId) loadMatch(initialMatchId, false);
    else void joinQueue();
    return () => {
      mounted = false;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  useEffect(() => {
    if (phase !== "searching" || !isSearching) return;
    const i = setInterval(() => setSearchTime(p => p + 1), 1000);
    return () => clearInterval(i);
  }, [phase, isSearching]);

  const endMatch = useCallback(async (forfeit?: { reason: string; meta: Record<string, number> }) => {
    if (!profile || matchEndedRef.current) return;
    matchEndedRef.current = true;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    await new Promise(r => setTimeout(r, 500));
    if (!matchData?.id) { setPhase("result"); return; }
    try {
      const { data, error } = await supabase.functions.invoke('process-match', { body: forfeit ? { matchId: matchData.id, forfeit } : { matchId: matchData.id } });
      if (error || (data && data.error)) console.error('process-match failed', error || data?.error);
      else if (data) {
        if (data.pending) { matchEndedRef.current = false; return; }
        if (botMatchRef.current) setBotOutcome(data.winnerTeam);
        winnerIdRef.current = data.winnerId ?? null;
        if (typeof data.coinsEarned === 'number' && typeof data.xpEarned === 'number') {
          setRewards({ coins: data.coinsEarned, xp: data.xpEarned });
          await refreshProfile();
        }
      }
    } catch (e) {
      console.error('process-match exception', e);
    }
    // 以服务器最终记录为准，避免显示成 0:0 平局
    for (let i = 0; i < 3; i++) {
      const { data: m } = await supabase.from('ranked_matches')
        .select('player1_score, player2_score, status, winner_id').eq('id', matchData.id).maybeSingle();
      if (m) {
        const mine = isPlayer1Ref.current ? m.player1_score : m.player2_score;
        myScoreRef.current = mine; setMyScoreDisplay(mine);
        setOpponentScore(isPlayer1Ref.current ? m.player2_score : m.player1_score);
        if (m.winner_id) winnerIdRef.current = m.winner_id;
        if (m.status === 'completed') break;
      }
      await new Promise(r => setTimeout(r, 800));
    }
    const winnerId = winnerIdRef.current;
    if (winnerId === profile.id) sounds.playVictory();
    else if (winnerId !== null) sounds.playDefeat();
    setPhase("result");
  }, [matchData, profile, sounds, refreshProfile]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      if (!question || questionLoading || questionError) return;
      setPhase("battle");
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => { if (prev <= 1) { endMatch(); return 0; } return prev - 1; });
      }, 1000);
      return;
    }
    const t = setTimeout(() => setCountdown(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown, endMatch, question, questionLoading, questionError]);

  useEffect(() => { if (question) setCurrentQuestion(question.questionIndex); }, [question]);

  // DAC：每题切换时重置计时
  useEffect(() => {
    if (phase === "battle") questionShownAtRef.current = Date.now();
  }, [currentQuestion, phase]);

  const handleAnswer = useCallback(async (answer: string): Promise<BattleAnswerResult> => {
    if (!matchData || !question || !profile || matchEndedRef.current || answeringRef.current) throw new Error("对局已结束");
    answeringRef.current = true;
    try {
      const data = await submitBattleAnswer(matchData.id, question.questionIndex, answer, Date.now() - questionShownAtRef.current);
      if (data.dacForfeit) { void endMatch(data.dacForfeit); return data; }
      if (data.matchEnded) { void endMatch(); return data; }
      const serverCorrect = data.isCorrect;
      if (!gradedQuestionsRef.current.has(question.questionIndex)) {
      gradedQuestionsRef.current.add(question.questionIndex);
      if (serverCorrect) {
        myScoreRef.current += 1;
      } else if (matchType === 'ranked') {
        myScoreRef.current -= 1;
      }
      setMyScoreDisplay(myScoreRef.current);
      setComboCount(prev => serverCorrect ? prev + 1 : 0);
      setAnswerAnimation(serverCorrect ? 'correct' : 'wrong');
      }
      setTimeout(() => {
        setAnswerAnimation(null);
        if (matchEndedRef.current) return;
        if (question.questionIndex + 1 >= question.total) void endMatch();
        else void loadQuestion();
      }, question.quizType === "spelling" || question.quizType === "listening" ? 2500 : 600);
      return data;
    } finally { answeringRef.current = false; }
  }, [matchData, question, profile, loadQuestion, endMatch]);

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
          {queueError && !isSearching && <Button className="mr-2" onClick={() => { setSearchTime(0); void joinQueue(); }}>重新匹配</Button>}
          <Button variant="outline" onClick={async () => { const left = await leaveQueue(); if (left !== false) onBack(); }}>
            <XCircle className="w-4 h-4 mr-2" />取消匹配
          </Button>
        </div>
        <DacBadge status="启动中" />
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
          {isBotMatch && <Badge variant="secondary">人机补位 · 不计排位分</Badge>}
          {matchLoadError && <div role="alert" className="mt-4 space-y-3">
            <p className="text-destructive">{matchLoadError}</p>
            <Button onClick={() => { const id = loadingMatchIdRef.current; if (id) void loadMatch(id, false); }}>重试</Button>
          </div>}
          <Button variant="outline" className="mt-4" onClick={onBack}>返回大厅（保留对局）</Button>
        </div>
        <DacBadge status="启动中" />
      </div>
    );
  }

  if (phase === "loading") {
    const card = opponentNameCard;
    const bg = card ? getNameCardGradientStyle(card.background_gradient || "") : undefined;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-lg w-full">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className={cn("w-6 h-6 rounded-full border-2 animate-spin", theme.accentSpinner)} />
            <h2 className="text-xl font-gaming text-muted-foreground tracking-widest">正在加载预讯...</h2>
          </div>

          <p className="text-xs text-muted-foreground mb-3 tracking-[0.3em]">—— 对手情报 ——</p>
          <p className={cn("text-2xl font-gaming animate-pulse", theme.accentText)}>
            {opponentProfile?.username || "神秘对手"}
          </p>
          {opponentNameCard && (
            <div className="mt-1 mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1">
              <BadgeIcon icon={opponentNameCard.icon || "Award"} className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-xs font-semibold text-amber-200 tracking-wide">{opponentNameCard.name}</span>
            </div>
          )}
          <div className="mb-4" />

          {opponentProfile?.lobby_card_image ? (
            <div className="relative mx-auto aspect-[4/7] w-[min(100%,280px,44svh)] rounded-lg overflow-hidden border border-border/50 bg-secondary/20 shadow-2xl">
              <img
                src={opponentProfile.lobby_card_image}
                alt={`${opponentProfile?.username || "对手"}的卡面`}
                className="absolute inset-0 h-full w-full object-contain"
              />
            </div>
          ) : card ? (
            <div
              className={cn("relative mx-auto aspect-[4/7] w-[min(100%,280px,44svh)] rounded-lg overflow-hidden border border-border/50 shadow-2xl", nameCardFxClass(card.rarity))}
              style={{ background: bg, ...nameCardFxStyle(card.rarity) }}
            >
              <NameCardFx rarity={card.rarity} background={bg} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
                <BadgeIcon icon={card.icon || "Award"} className="w-10 h-10 text-white drop-shadow-lg" />
                <div className="text-lg font-gaming text-white drop-shadow-md">{card.name}</div>
                {card.rank_position && (
                  <div className="text-xs text-white/90 bg-black/30 rounded-full px-3 py-0.5">#{card.rank_position}</div>
                )}
                <span className={cn("text-[10px] uppercase tracking-widest bg-black/30 rounded-full px-2 py-0.5", rarityColors[card.rarity])}>
                  {rarityLabels[card.rarity] || card.rarity}
                </span>
              </div>
            </div>
          ) : (
            <div className="mx-auto aspect-[4/7] w-[min(100%,280px,44svh)] rounded-lg border border-dashed border-border/50 flex items-center justify-center bg-secondary/20">
              <span className="text-sm text-muted-foreground">对方未佩戴名片</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-6 animate-pulse">数据同步中，即将开战…</p>
          <Button variant="outline" className="mt-4" onClick={onBack}>返回大厅（保留对局）</Button>
        </div>
        <DacBadge status="启动中" />
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
          {isBotMatch && <Badge variant="secondary">人机补位 · 不计排位分</Badge>}
          <div className={cn("text-8xl font-gaming animate-bounce", theme.accentText)}>
            {countdown > 0 ? countdown : question ? 'GO!' : '…'}
          </div>
          {countdown <= 0 && !question && !questionError && <p className="mt-4 text-muted-foreground">题目加载中...</p>}
          {questionError && <div role="alert" className="mt-4 text-destructive">
            <p>{questionError}</p>
            <Button variant="outline" onClick={() => void loadQuestion()} disabled={questionLoading}>重试</Button>
          </div>}
          <Button variant="outline" className="mt-4" onClick={onBack}>返回大厅（保留对局）</Button>
        </div>
        <DacBadge status="启动中" />
      </div>
    );
  }

  if (phase === "battle" && matchData) {

    const total = question?.total || matchData.question_count;
    const progressPercent = total > 0 ? (currentQuestion / total) * 100 : 0;
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto mb-4">
          {isBotMatch && <Badge variant="secondary" className="mb-2">人机补位 · 不计排位分</Badge>}
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
              {(opponentProfile?.lobby_card_image || opponentNameCard) && (
                <div
                  className="w-9 h-12 rounded-sm overflow-hidden border border-border/60 shrink-0"
                  style={!opponentProfile?.lobby_card_image && opponentNameCard
                    ? { background: getNameCardGradientStyle(opponentNameCard.background_gradient || "") }
                    : undefined}
                  title={opponentNameCard?.name || "对手卡面"}
                >
                  {opponentProfile?.lobby_card_image && (
                    <img
                      src={opponentProfile.lobby_card_image}
                      alt=""
                      className="h-full w-full object-cover"
                      style={{ objectPosition: "center 30%" }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-muted-foreground">
              {total > 0 ? <>第 {currentQuestion + 1}/{total} 题</> : "题目加载中..."}
            </span>
            {comboCount >= 2 && (
              <Badge variant="default" className="animate-pulse">
                <Zap className="w-3 h-3 mr-1" />{comboCount} 连击!
              </Badge>
            )}
          </div>
        </div>
        <KillStreakBanner combo={comboCount} />
        {question && (
          <ServerBattleQuizCard key={question.questionIndex} question={question} matchId={matchData.id}
            onAnswer={handleAnswer} comboCount={comboCount} disabled={questionLoading || !!questionError} onHealthChange={setAnswerHealthy} />
        )}
        {questionError && <div role="alert" className="text-center mt-4 text-destructive">
          <p>{questionError}</p><Button variant="outline" disabled={questionLoading} onClick={() => void loadQuestion()}>重试</Button>
        </div>}
        {questionLoading && <p className="text-center mt-4 text-muted-foreground">题目加载中...</p>}
        <div className="text-center mt-4"><Button variant="outline" onClick={onBack}>返回大厅（保留对局）</Button></div>
        <DacBadge status={questionLoading || questionError || !answerHealthy ? "启动中" : "监控中"} onForfeit={(reason, meta) => endMatch({ reason, meta })} />
        <SoundVariantSwitcher />
      </div>
    );
  }

  if (phase === "result") {
    const finalScore = myScoreRef.current;
    const winnerId = winnerIdRef.current;
    const isWinner = isBotMatch ? botOutcome === 1 : winnerId === profile.id;
    const isDraw = isBotMatch ? botOutcome === null : winnerId === null;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card variant="glow" className="max-w-md w-full p-8 text-center">
          {isDraw ? <Icon className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            : isWinner ? <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4 animate-bounce" />
            : <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />}
          <h2 className="text-3xl font-gaming mb-2">
            {isDraw ? '平局！' : isWinner ? '胜利！' : '失败'}
          </h2>
          {isBotMatch && <Badge variant="secondary">人机补位 · 不计排位分</Badge>}
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
          {matchType === 'ranked' && (
            <p className="text-xs text-muted-foreground -mt-2 mb-4">排位计分：答对 +1，答错 -1，按净分定胜负</p>
          )}
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
          <DacCheaterNotice matchId={matchData?.id} isWinner={isWinner} />
          <Button onClick={onBack} className="w-full" size="lg">返回</Button>
        </Card>
      </div>
    );
  }

  return null;
};

export default BattleArena;
