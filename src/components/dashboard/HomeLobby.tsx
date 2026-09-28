import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Swords, Bot, Users, Globe, BookOpen, ChevronRight, Award } from "lucide-react";
import PlayerStats from "../PlayerStats";
import RankDisplay from "../RankDisplay";
import DailyQuest from "../DailyQuest";
import NameCardFx, { nameCardFxClass, nameCardFxStyle } from "../NameCardFx";
import { getNameCardGradientStyle } from "../profile-card/utils";
import { cn } from "@/lib/utils";
import { zoneName } from "@/lib/zones";
import ModeSelect from "./ModeSelect";
import type { DashboardView } from "./DashboardNav";

interface EquippedCard {
  name: string;
  icon: string | null;
  rarity: string;
  background_gradient: string;
}

interface HomeLobbyProps {
  profile: any;
  grade: number;
  playerData: any;
  refreshKey: number;
  onEnergyPurchased: () => void;
  onNavigate: (view: DashboardView) => void;
  onStartMatch: () => void;
  onFreeMatch: () => void;
}

const RANK_NAME: Record<string, string> = {
  bronze: "青铜", silver: "白银", gold: "黄金", platinum: "铂金",
  diamond: "钻石", star: "星耀", ace: "王牌", champion: "狄邦巅峰",
};

const HomeLobby = ({
  profile, grade, playerData, refreshKey,
  onEnergyPurchased, onNavigate, onStartMatch, onFreeMatch,
}: HomeLobbyProps) => {
  const [card, setCard] = useState<EquippedCard | null>(null);
  const [showModes, setShowModes] = useState(false);

  useEffect(() => {
    if (!profile?.id) { setCard(null); return; }
    supabase
      .from("user_name_cards")
      .select("name_cards (name, icon, rarity, background_gradient)")
      .eq("profile_id", profile.id)
      .eq("is_equipped", true)
      .maybeSingle()
      .then(({ data }) => {
        const c = (data as any)?.name_cards;
        setCard(c ?? null);
      });
  }, [profile?.id, refreshKey]);

  const cardBg = card ? getNameCardGradientStyle(card.background_gradient) : undefined;
  const rankName = RANK_NAME[profile?.rank_tier] ?? "青铜";

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
      {/* ===== 左栏：玩家数据 + 快速入口 ===== */}
      <div className="order-2 lg:order-1 space-y-4">
        <div data-tour="stats">
          <PlayerStats {...playerData} profileId={profile?.id} onEnergyPurchased={onEnergyPurchased} />
        </div>
        <div className="border border-border/60 bg-secondary/30 val-cut-sm">
          <LobbyRow icon={BookOpen} label="进入关卡" tour="levels" onClick={() => onNavigate("learn")} />
          <LobbyRow icon={Bot} label="人机练习" onClick={() => onNavigate("bot")} />
          <LobbyRow icon={Users} label="好友对战" onClick={() => onNavigate("friends")} />
          <LobbyRow icon={Globe} label="自由服" onClick={onFreeMatch} last />
        </div>
      </div>

      {/* ===== 中栏：名片英雄位 + 匹配按钮 ===== */}
      <div className="order-1 lg:order-2 flex flex-col items-center justify-center gap-6 py-2">
        {/* 顶部状态条 */}
        <div className="flex items-center gap-8 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">分区</div>
            <div className="font-tactical font-semibold">{zoneName(Number(grade))}</div>
          </div>
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div className="absolute inset-0 rotate-45 border-2 border-primary/70 bg-secondary/40" />
            <span className="relative font-tactical text-2xl font-bold text-glow-red">{playerData.level}</span>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">段位</div>
            <div className="font-tactical font-semibold">{rankName}</div>
          </div>
        </div>

        {/* 名片主视觉 */}
        <div
          className={cn(
            "relative w-72 max-w-full aspect-[3/4.2] overflow-hidden border border-border/60 val-cut shadow-2xl",
            card && nameCardFxClass(card.rarity)
          )}
          style={card ? { background: cardBg, ...nameCardFxStyle(card.rarity) } : { background: "linear-gradient(160deg, hsl(213 24% 14%), hsl(213 28% 8%))" }}
        >
          {card && <NameCardFx rarity={card.rarity} background={cardBg} />}
          {!card && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Award className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          {/* 底部信息条 */}
          <div className="absolute inset-x-0 bottom-0 z-10 border-t border-white/15 bg-black/45 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 bg-emerald-400" />
              <span className="text-[11px] font-semibold tracking-widest text-emerald-300">就绪</span>
            </div>
            <div className="mt-1 font-tactical text-xl font-bold uppercase leading-none text-white">
              {playerData.username}
            </div>
            <div className="mt-0.5 text-xs text-white/70">
              {card ? card.name : "未佩戴名片"} · {rankName}
            </div>
          </div>
        </div>

        {/* 匹配按钮 */}
        <button
          onClick={() => setShowModes(true)}
          className="val-cut h-14 w-72 max-w-full bg-primary font-tactical text-xl font-bold uppercase tracking-[0.3em] text-primary-foreground shadow-lg shadow-primary/40 transition-all hover:bg-primary/90 hover:shadow-primary/60 active:scale-[0.98]"
        >
          <span className="inline-flex items-center gap-2">
            <Swords className="h-5 w-5" /> 匹配游戏
          </span>
        </button>
      </div>

      {/* ===== 右栏：段位 + 每日任务 + 赛季手册 ===== */}
      <div className="order-3 space-y-4">
        {profile && (
          <RankDisplay tier={profile.rank_tier as any} stars={profile.rank_stars} wins={profile.wins} losses={profile.losses} />
        )}
        <div data-tour="quests">
          <DailyQuest key={refreshKey} onQuestUpdate={onEnergyPurchased} />
        </div>
        {profile && (
          <button
            onClick={() => onNavigate("seasonpass")}
            className="group relative w-full overflow-hidden border border-border/60 bg-gradient-to-br from-primary/25 via-secondary/40 to-secondary/20 val-cut-sm p-4 text-left transition-all hover:border-primary/60"
          >
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">赛季手册</div>
            <div className="mt-1 font-tactical text-lg font-bold uppercase">S2「远航」</div>
            <div className="mt-1 text-xs text-muted-foreground">升级手册，解锁限定名片与勋章</div>
            <ChevronRight className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary transition-transform group-hover:translate-x-1" />
          </button>
        )}
      </div>
    </div>

      {showModes && (
        <ModeSelect
          onClose={() => setShowModes(false)}
          onRanked={onStartMatch}
          onFree={onFreeMatch}
          on2v2={() => onNavigate("battle2v2-select")}
          onBot={() => onNavigate("bot")}
          onFriends={() => onNavigate("friends")}
        />
      )}
    </div>
  );
};

const LobbyRow = ({ icon: Icon, label, onClick, last, tour }: { icon: any; label: string; onClick: () => void; last?: boolean; tour?: string }) => (
  <button
    onClick={onClick}
    data-tour={tour}
    className={cn(
      "flex w-full items-center justify-between px-4 py-3 text-sm font-medium tracking-wider transition-colors hover:bg-primary/15 hover:text-primary",
      !last && "border-b border-border/50"
    )}
  >
    <span>{label}</span>
    <Icon className="h-4 w-4 opacity-70" />
  </button>
);

export default HomeLobby;
