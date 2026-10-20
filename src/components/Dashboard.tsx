import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import { useBadgeChecker } from "@/hooks/useBadgeChecker";
import { useNameCardChecker } from "@/hooks/useNameCardChecker";
import { useMatchReconnect } from "@/hooks/useMatchReconnect";
import PlayerStats from "./PlayerStats";
import LevelProgress from "./LevelProgress";
import MathLevelProgress from "./MathLevelProgress";
import MathWordLearning from "./MathWordLearning";
import ScienceLevelProgress from "./ScienceLevelProgress";
import ScienceWordLearning from "./ScienceWordLearning";
import HSLevelProgress, { HSWord } from "./HSLevelProgress";
import HSWordLearning from "./HSWordLearning";
import LeaderboardTabs from "./LeaderboardTabs";
import DailyQuest from "./DailyQuest";
import ChallengeArena from "./ChallengeArena";
import WordLearning from "./WordLearning";
import RankedBattle from "./RankedBattle";
import FreeMatchBattle from "./FreeMatchBattle";
import Battle2v2Arena from "./Battle2v2Arena";
import { useLobbyParty } from "@/hooks/useLobbyParty";
import { canSelectPartyMode } from "@/lib/partyRules";
import Battle2v2Practice from "./Battle2v2Practice";
import BotBattle from "./BotBattle";
import ProfileCard from "./ProfileCard";
import BadgeDisplay from "./BadgeDisplay";
import LearningStats from "./LearningStats";
import WrongWordBook from "./WrongWordBook";
import WrongWordReview from "./WrongWordReview";
import SeasonPass from "./SeasonPass";
import { FriendsPanel } from "./friends/FriendsPanel";
import RankDisplay from "./RankDisplay";
import SpectateView from "./SpectateView";
import MatchHistory from "./MatchHistory";
import { ReconnectDialog } from "./ReconnectDialog";
import { TeamPanel } from "./team/TeamPanel";
import { Swords, Globe } from "lucide-react";
import SubjectBattleSelector, { BattleSubject } from "./SubjectBattleSelector";
import { toast } from "sonner";
import DashboardHeader from "./dashboard/DashboardHeader";
import DashboardNav, { DashboardView } from "./dashboard/DashboardNav";
import HomeLobby from "./dashboard/HomeLobby";
import LoginRequired from "./dashboard/LoginRequired";
import { isPrimaryZone, usesZoneWordBank, zoneName } from "@/lib/zones";
import { useUiMode } from "@/hooks/useUiMode";

interface DashboardProps { grade: number; }

const Dashboard = ({ grade }: DashboardProps) => {
  const navigate = useNavigate();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { isAdmin } = useAdminRole();
  const { checkAndAwardBadges } = useBadgeChecker(profile);
  const checkNameCards = useNameCardChecker(profile);

  const [activeView, setActiveView] = useState<DashboardView>("home");
  const [selectedLevel, setSelectedLevel] = useState<{ id: string; name: string } | null>(null);
  const [selectedMathLevel, setSelectedMathLevel] = useState<{ id: string; name: string; words: any[] } | null>(null);
  const [selectedScienceLevel, setSelectedScienceLevel] = useState<{ id: string; name: string; words: any[] } | null>(null);
  const [selectedHSLevel, setSelectedHSLevel] = useState<{ id: string; name: string; words: HSWord[]; mode?: "learn" | "quiz" } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const isHighSchool = Number(grade) >= 9;
  const isPrimary = isPrimaryZone(Number(grade));
  const useZoneBank = usesZoneWordBank(Number(grade));
  const [friendBattleMatchId, setFriendBattleMatchId] = useState<string | null>(null);
  const [wrongWordsToReview, setWrongWordsToReview] = useState<any[] | null>(null);
  const [wrongReviewSubject, setWrongReviewSubject] = useState<"english" | "math" | "science" | "hs">("english");
  const [spectateMatchId, setSpectateMatchId] = useState<string | null>(null);
  const [reconnectMatchId, setReconnectMatchId] = useState<string | null>(null);
  const [reconnectMatchType, setReconnectMatchType] = useState<"ranked" | "free">("ranked");
  const [battleSubject, setBattleSubject] = useState<BattleSubject>("mixed");
  const { isClassic } = useUiMode();
  const partyState = useLobbyParty(profile);
  const [partyMatchId, setPartyMatchId] = useState<string | null>(null);
  const [startingPartyId, setStartingPartyId] = useState<string | null>(null);
  const navigateView = (view: DashboardView) => {
    const mode = view.startsWith("battle2v2") ? "2v2" : view.startsWith("battle") ? "ranked"
      : view.startsWith("freematch") ? "free" : view === "bot" ? "bot" : view.includes("learn") || view === "wrongbook" ? "levels" : null;
    if (mode && !canSelectPartyMode(mode, !!partyState.party)) return;
    if (mode === "2v2" && partyState.party && !partyState.canStart) return;
    setActiveView(view);
  };

  useEffect(() => {
    const party = partyState.party;
    if (party?.status === "matched" && party.match_id) {
      setPartyMatchId(party.match_id);
      setBattleSubject(party.subject as BattleSubject);
      setActiveView("battle2v2");
    }
  }, [partyState.party?.status, partyState.party?.match_id]);

  const { activeMatch, dismissMatch, clearActiveMatch } = useMatchReconnect({
    profileId: profile?.id,
    enabled: activeView === "home",
  });

  // 接受组队邀请后返回主大厅，共享队伍状态继续同步。
  useEffect(() => {
    const onPartyAccepted = () => setActiveView("home");
    window.addEventListener("party-2v2-accepted", onPartyAccepted);
    return () => window.removeEventListener("party-2v2-accepted", onPartyAccepted);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast.success("已退出登录");
    navigate("/auth");
  };
  const handleSelectLevel = (id: string, name: string) => {
    setSelectedLevel({ id, name });
    setActiveView("learn");
  };
  const handleBackFromLearning = () => {
    setSelectedLevel(null);
    setActiveView("home");
    setRefreshKey(p => p + 1);
    refreshProfile();
    setTimeout(() => { checkAndAwardBadges(); checkNameCards(); }, 500);
  };
  const handleSelectMathLevel = (id: string, name: string, words: any[]) => {
    setSelectedMathLevel({ id, name, words }); setActiveView("mathlearn");
  };
  const handleBackFromMathLearning = () => {
    setSelectedMathLevel(null); setActiveView("learn");
    setRefreshKey(p => p + 1); refreshProfile();
  };
  const handleSelectScienceLevel = (id: string, name: string, words: any[]) => {
    setSelectedScienceLevel({ id, name, words }); setActiveView("sciencelearn");
  };
  const handleBackFromScienceLearning = () => {
    setSelectedScienceLevel(null); setActiveView("learn");
    setRefreshKey(p => p + 1); refreshProfile();
  };
  const handleSelectHSLevel = (id: string, name: string, words: HSWord[], mode: "learn" | "quiz" = "learn") => {
    setSelectedHSLevel({ id, name, words, mode }); setActiveView("hslearn");
  };
  const handleBackFromHSLearning = () => {
    setSelectedHSLevel(null); setActiveView("learn");
    setRefreshKey(p => p + 1); refreshProfile();
  };
  const handleFriendBattleStart = (matchId: string) => {
    if (partyState.party) return;
    setFriendBattleMatchId(matchId); setActiveView("battle");
  };
  const handleSpectate = (matchId: string) => {
    setSpectateMatchId(matchId); setActiveView("spectate");
  };
  const handleReconnect = () => {
    if (!activeMatch) return;
    setReconnectMatchId(activeMatch.id);
    setReconnectMatchType(activeMatch.type);
    setBattleSubject(activeMatch.subject as BattleSubject);
    if (activeMatch.mode === "2v2") setPartyMatchId(activeMatch.id);
    clearActiveMatch();
    setActiveView(activeMatch.mode === "2v2" ? "battle2v2" : activeMatch.type === "ranked" ? "battle" : "freematch");
  };
  const handleDismissReconnect = async () => {
    try { await dismissMatch(); toast.info("已放弃比赛"); }
    catch { toast.error("退赛未能确认，请重试"); }
  };

  // ===== Full-screen subviews =====
  if (activeView === "team") return <TeamPanel onBack={() => setActiveView("home")} />;

  if (activeView === "spectate" && spectateMatchId) {
    return <SpectateView matchId={spectateMatchId} onBack={() => {
      setSpectateMatchId(null); setActiveView("friends");
    }} />;
  }

  if (activeView === "battle-select") {
    return <SubjectBattleSelector battleType="ranked" isHighSchool={isHighSchool} zoneGrade={Number(grade)}
      onSelectSubject={s => { setBattleSubject(s); setActiveView("battle"); }}
      onBack={() => setActiveView("home")} />;
  }
  if (activeView === "freematch-select") {
    return <SubjectBattleSelector battleType="free" isHighSchool={isHighSchool} zoneGrade={Number(grade)}
      onSelectSubject={s => { setBattleSubject(s); setActiveView("freematch"); }}
      onBack={() => setActiveView("home")} />;
  }
  if (activeView === "battle2v2-select") {
    return <SubjectBattleSelector battleType="ranked" isHighSchool={isHighSchool} zoneGrade={Number(grade)}
      onSelectSubject={async s => {
        if (partyState.party) {
          if (!await partyState.prepare(s)) return;
          setStartingPartyId(partyState.party.id);
        }
        setBattleSubject(s); setActiveView("battle2v2");
      }}
      onBack={() => setActiveView("home")} />;
  }
  if (activeView === "battle2v2") {
    if (!user) return <LoginRequired Icon={Swords} title="登录后参与 2v2 排位赛"
      subtitle="组队 4 人切磋词汇！" onBack={() => setActiveView("home")} />;
    return <Battle2v2Arena subject={battleSubject} partyId={startingPartyId} initialMatchId={partyMatchId} onBack={async () => {
      setPartyMatchId(null); setStartingPartyId(null);
      if (partyState.party) await partyState.leave();
      setActiveView("home");
      setRefreshKey(p => p + 1); refreshProfile();
      setBattleSubject("mixed");
      setTimeout(() => { checkAndAwardBadges(); checkNameCards(); }, 500);
    }} />;
  }
  if (activeView === "battle2v2-practice") {
    if (!user) return <LoginRequired Icon={Swords} title="登录后体验 2v2 练习"
      subtitle="和 Bot 队友一起对战 2 个 Bot！" onBack={() => setActiveView("home")} />;
    return <Battle2v2Practice onBack={() => setActiveView("home")} />;
  }

  if (activeView === "battle") {
    if (!user) return <LoginRequired Icon={Swords} title="登录后参与排位赛"
      subtitle="与同年级玩家实时对战！" onBack={() => setActiveView("home")} />;
    const matchIdToUse = reconnectMatchId || friendBattleMatchId;
    return <RankedBattle initialMatchId={matchIdToUse} subject={battleSubject} onBack={() => {
      setActiveView("home");
      setRefreshKey(p => p + 1); refreshProfile();
      setFriendBattleMatchId(null); setReconnectMatchId(null); setBattleSubject("mixed");
      setTimeout(() => { checkAndAwardBadges(); checkNameCards(); }, 500);
    }} />;
  }

  if (activeView === "freematch") {
    if (!user) return <LoginRequired Icon={Globe} iconClassName="text-neon-cyan"
      title="登录后参与自由服" subtitle="跨年级自由匹配对战！" onBack={() => setActiveView("home")} />;
    return <FreeMatchBattle subject={battleSubject}
      initialMatchId={reconnectMatchType === "free" ? reconnectMatchId : null}
      onBack={() => {
        setActiveView("home");
        setRefreshKey(p => p + 1); refreshProfile();
        setReconnectMatchId(null); setBattleSubject("mixed");
        setTimeout(() => { checkAndAwardBadges(); checkNameCards(); }, 500);
      }} />;
  }

  if (activeView === "history") return <MatchHistory onBack={() => setActiveView("home")} />;

  if (activeView === "bot") {
    if (!user) return <LoginRequired Icon={Swords} title="登录后参与人机对抗"
      subtitle="选择难度，和 AI 切磋词汇！" onBack={() => setActiveView("home")} />;
    return <BotBattle onBack={() => {
      setActiveView("home");
      setRefreshKey(p => p + 1); refreshProfile();
      setTimeout(() => { checkAndAwardBadges(); checkNameCards(); }, 500);
    }} />;
  }

  if (activeView === "hslearn" && selectedHSLevel) {
    return <HSWordLearning levelId={selectedHSLevel.id} levelName={selectedHSLevel.name}
      words={selectedHSLevel.words} startPhase={selectedHSLevel.mode === "quiz" ? "quiz" : "learn"}
      onBack={handleBackFromHSLearning} onComplete={handleBackFromHSLearning} />;
  }
  if (activeView === "wrongbook" && wrongWordsToReview) {
    return <WrongWordReview words={wrongWordsToReview} subject={wrongReviewSubject}
      onBack={() => setWrongWordsToReview(null)}
      onComplete={() => {
        setWrongWordsToReview(null); setRefreshKey(p => p + 1); refreshProfile();
      }} />;
  }
  if (activeView === "learn" && selectedLevel) {
    return <WordLearning levelId={selectedLevel.id} levelName={selectedLevel.name}
      onBack={handleBackFromLearning} onComplete={handleBackFromLearning} />;
  }
  if (activeView === "mathlearn" && selectedMathLevel) {
    return <MathWordLearning levelId={selectedMathLevel.id} levelName={selectedMathLevel.name}
      words={selectedMathLevel.words}
      onBack={handleBackFromMathLearning} onComplete={handleBackFromMathLearning} />;
  }
  if (activeView === "sciencelearn" && selectedScienceLevel) {
    return <ScienceWordLearning levelId={selectedScienceLevel.id} levelName={selectedScienceLevel.name}
      words={selectedScienceLevel.words}
      onBack={handleBackFromScienceLearning} onComplete={handleBackFromScienceLearning} />;
  }

  // ===== Main shell =====
  const playerData = profile ? {
    username: profile.username, level: profile.level, xp: profile.xp,
    xpToNextLevel: profile.xp_to_next_level, energy: profile.energy,
    maxEnergy: profile.max_energy, coins: profile.coins, streak: profile.streak,
    rank: profile.rank_tier.charAt(0).toUpperCase() + profile.rank_tier.slice(1),
  } : {
    username: "游客", level: 1, xp: 0, xpToNextLevel: 100,
    energy: 10, maxEnergy: 10, coins: 0, streak: 0, rank: "Bronze",
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern">
      <DashboardHeader grade={grade} className={profile?.class} user={user} isAdmin={isAdmin} onSignOut={handleSignOut} />
      <DashboardNav activeView={activeView} onSelect={navigateView} />

      <main className="container mx-auto px-4 py-6">
        {activeView === "home" && (
          isClassic && !partyState.party ? (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="space-y-6">
                <div data-tour="stats"><PlayerStats {...playerData} profileId={profile?.id} onEnergyPurchased={refreshProfile} /></div>
                {profile && (
                  <RankDisplay tier={profile.rank_tier as any} stars={profile.rank_stars}
                    wins={profile.wins} losses={profile.losses} />
                )}
                <div data-tour="quests"><DailyQuest key={refreshKey} onQuestUpdate={() => refreshProfile()} /></div>
              </div>
              <div className="lg:col-span-2" data-tour="levels">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-gaming text-xl">学习关卡</h2>
                  <Badge variant="energy">{zoneName(Number(grade))}分区</Badge>
                </div>
                {useZoneBank ? (
                  <HSLevelProgress key={`hs-${grade}-${refreshKey}`} grade={Number(grade)} onSelectLevel={handleSelectHSLevel} />
                ) : (
                  <LevelProgress key={refreshKey} grade={grade as 7 | 8} onSelectLevel={handleSelectLevel} />
                )}
              </div>
            </div>
          ) : (
            <HomeLobby
              partyState={partyState}
              profile={profile}
              grade={grade}
              playerData={playerData}
              refreshKey={refreshKey}
              onEnergyPurchased={refreshProfile}
              onNavigate={navigateView}
              onStartMatch={() => navigateView("battle-select")}
              onFreeMatch={() => navigateView("freematch-select")}
            />
          )
        )}

        {activeView === "learn" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {useZoneBank ? (
              <div>
                <h2 className="font-gaming text-xl mb-4">{isPrimary ? "🧒" : "🎓"} {zoneName(Number(grade))}分区</h2>
                <HSLevelProgress key={`hs-${grade}-${refreshKey}`} grade={Number(grade)} onSelectLevel={handleSelectHSLevel} />
              </div>
            ) : (
              <>
                <div>
                  <h2 className="font-gaming text-xl mb-4">📚 {grade}年级单词</h2>
                  <LevelProgress key={refreshKey} grade={grade as 7 | 8} onSelectLevel={handleSelectLevel} />
                </div>
                <div className="pt-4 border-t border-border/50">
                  <h2 className="font-gaming text-xl mb-4">🔢 0580数学词汇</h2>
                  <MathLevelProgress key={`math-${refreshKey}`} onSelectLevel={handleSelectMathLevel} />
                </div>
                <div className="pt-4 border-t border-border/50">
                  <h2 className="font-gaming text-xl mb-4">🧪 科学词汇</h2>
                  <ScienceLevelProgress key={`science-${refreshKey}`} onSelectLevel={handleSelectScienceLevel} />
                </div>
              </>
            )}
          </div>
        )}

        {activeView === "leaderboard" && (
          <div className="max-w-2xl mx-auto">
            <LeaderboardTabs grade={grade} currentUser={profile?.username}
              currentProfileId={profile?.id} currentClass={profile?.class} />
          </div>
        )}

        {activeView === "challenge" && (
          <div className="max-w-2xl mx-auto">
            <ChallengeArena grade={grade} currentClass={profile?.class} profileId={profile?.id} />
          </div>
        )}

        {activeView === "seasonpass" && profile && (
          <div className="max-w-2xl mx-auto">
            <SeasonPass grade={grade} profileId={profile.id} />
          </div>
        )}

        {activeView === "wrongbook" && profile && (
          <div className="max-w-2xl mx-auto">
            <WrongWordBook onStartReview={(words, subject) => { setWrongReviewSubject(subject); setWrongWordsToReview(words); }} />
          </div>
        )}

        {activeView === "friends" && profile && (
          <div className="max-w-2xl mx-auto">
            <FriendsPanel currentProfileId={profile.id} currentGrade={profile.grade}
              onBattleStart={handleFriendBattleStart} onSpectate={handleSpectate} />
          </div>
        )}

        {activeView === "profile" && profile && (
          <div className="max-w-2xl mx-auto space-y-6">
            <ProfileCard />
            <LearningStats />
            <BadgeDisplay />
          </div>
        )}
      </main>

      {activeMatch && (
        <ReconnectDialog activeMatch={activeMatch}
          onReconnect={handleReconnect} onDismiss={handleDismissReconnect} />
      )}
    </div>
  );
};

export default Dashboard;
