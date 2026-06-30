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
import LeaderboardTabs from "./LeaderboardTabs";
import DailyQuest from "./DailyQuest";
import ChallengeArena from "./ChallengeArena";
import WordLearning from "./WordLearning";
import RankedBattle from "./RankedBattle";
import FreeMatchBattle from "./FreeMatchBattle";
import Battle2v2Arena from "./Battle2v2Arena";
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
import LoginRequired from "./dashboard/LoginRequired";

interface DashboardProps { grade: 7 | 8; }

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [friendBattleMatchId, setFriendBattleMatchId] = useState<string | null>(null);
  const [wrongWordsToReview, setWrongWordsToReview] = useState<any[] | null>(null);
  const [wrongReviewSubject, setWrongReviewSubject] = useState<"english" | "math" | "science">("english");
  const [spectateMatchId, setSpectateMatchId] = useState<string | null>(null);
  const [reconnectMatchId, setReconnectMatchId] = useState<string | null>(null);
  const [reconnectMatchType, setReconnectMatchType] = useState<"ranked" | "free">("ranked");
  const [battleSubject, setBattleSubject] = useState<BattleSubject>("mixed");

  const { activeMatch, dismissMatch, clearActiveMatch } = useMatchReconnect({
    profileId: profile?.id,
    enabled: activeView === "home",
  });

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
  const handleFriendBattleStart = (matchId: string) => {
    setFriendBattleMatchId(matchId); setActiveView("battle");
  };
  const handleSpectate = (matchId: string) => {
    setSpectateMatchId(matchId); setActiveView("spectate");
  };
  const handleReconnect = () => {
    if (!activeMatch) return;
    setReconnectMatchId(activeMatch.id);
    setReconnectMatchType(activeMatch.type);
    clearActiveMatch();
    setActiveView(activeMatch.type === "ranked" ? "battle" : "freematch");
  };
  const handleDismissReconnect = async () => {
    await dismissMatch();
    toast.info("已放弃比赛");
  };

  // ===== Full-screen subviews =====
  if (activeView === "team") return <TeamPanel onBack={() => setActiveView("home")} />;

  if (activeView === "spectate" && spectateMatchId) {
    return <SpectateView matchId={spectateMatchId} onBack={() => {
      setSpectateMatchId(null); setActiveView("friends");
    }} />;
  }

  if (activeView === "battle-select") {
    return <SubjectBattleSelector battleType="ranked"
      onSelectSubject={s => { setBattleSubject(s); setActiveView("battle"); }}
      onBack={() => setActiveView("home")} />;
  }
  if (activeView === "freematch-select") {
    return <SubjectBattleSelector battleType="free"
      onSelectSubject={s => { setBattleSubject(s); setActiveView("freematch"); }}
      onBack={() => setActiveView("home")} />;
  }
  if (activeView === "battle2v2-select") {
    return <SubjectBattleSelector battleType="ranked"
      onSelectSubject={s => { setBattleSubject(s); setActiveView("battle2v2"); }}
      onBack={() => setActiveView("home")} />;
  }
  if (activeView === "battle2v2") {
    if (!user) return <LoginRequired Icon={Swords} title="登录后参与 2v2 排位赛"
      subtitle="组队 4 人切磋词汇！" onBack={() => setActiveView("home")} />;
    return <Battle2v2Arena subject={battleSubject} onBack={() => {
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
      <DashboardNav activeView={activeView} onSelect={setActiveView} />

      <main className="container mx-auto px-4 py-6">
        {activeView === "home" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="space-y-6">
              <PlayerStats {...playerData} profileId={profile?.id} onEnergyPurchased={refreshProfile} />
              {profile && (
                <RankDisplay tier={profile.rank_tier as any} stars={profile.rank_stars}
                  wins={profile.wins} losses={profile.losses} />
              )}
              <DailyQuest key={refreshKey} onQuestUpdate={() => refreshProfile()} />
            </div>
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-gaming text-xl">学习关卡</h2>
                <Badge variant="energy">{grade}年级</Badge>
              </div>
              <LevelProgress key={refreshKey} grade={grade} onSelectLevel={handleSelectLevel} />
            </div>
          </div>
        )}

        {activeView === "learn" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div>
              <h2 className="font-gaming text-xl mb-4">📚 {grade}年级单词</h2>
              <LevelProgress key={refreshKey} grade={grade} onSelectLevel={handleSelectLevel} />
            </div>
            <div className="pt-4 border-t border-border/50">
              <h2 className="font-gaming text-xl mb-4">🔢 0580数学词汇</h2>
              <MathLevelProgress key={`math-${refreshKey}`} onSelectLevel={handleSelectMathLevel} />
            </div>
            <div className="pt-4 border-t border-border/50">
              <h2 className="font-gaming text-xl mb-4">🧪 科学词汇</h2>
              <ScienceLevelProgress key={`science-${refreshKey}`} onSelectLevel={handleSelectScienceLevel} />
            </div>
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
