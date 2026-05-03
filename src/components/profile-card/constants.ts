export type RankTier = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "champion";

export const RANK_CONFIG: Record<RankTier, {
  starsToPromote: number;
  starsLostOnLose: number;
  protectionStars: number;
}> = {
  bronze: { starsToPromote: 30, starsLostOnLose: 0, protectionStars: 0 },
  silver: { starsToPromote: 40, starsLostOnLose: 1, protectionStars: 0 },
  gold: { starsToPromote: 50, starsLostOnLose: 1, protectionStars: 1 },
  platinum: { starsToPromote: 50, starsLostOnLose: 1, protectionStars: 0 },
  diamond: { starsToPromote: 60, starsLostOnLose: 2, protectionStars: 0 },
  champion: { starsToPromote: 999, starsLostOnLose: 2, protectionStars: 0 },
};

export const TIER_ORDER: RankTier[] = ["bronze", "silver", "gold", "platinum", "diamond", "champion"];

export const tierNames: Record<RankTier, string> = {
  bronze: "青铜", silver: "白银", gold: "黄金",
  platinum: "铂金", diamond: "钻石", champion: "狄邦巅峰",
};

export const tierColors: Record<RankTier, { gradient: string; text: string; bg: string }> = {
  bronze: { gradient: "from-amber-700 to-amber-900", text: "text-amber-500", bg: "bg-amber-500/20" },
  silver: { gradient: "from-gray-300 to-gray-500", text: "text-gray-400", bg: "bg-gray-400/20" },
  gold: { gradient: "from-yellow-400 to-amber-500", text: "text-yellow-500", bg: "bg-yellow-500/20" },
  platinum: { gradient: "from-cyan-300 to-cyan-500", text: "text-cyan-400", bg: "bg-cyan-400/20" },
  diamond: { gradient: "from-blue-300 to-purple-400", text: "text-blue-400", bg: "bg-blue-400/20" },
  champion: { gradient: "from-purple-500 to-pink-500", text: "text-purple-400", bg: "bg-purple-400/20" },
};

export const backgroundOptions = [
  { id: "default", gradient: "from-primary/20 via-accent/10 to-primary/20", name: "默认" },
  { id: "sunset", gradient: "from-orange-500/30 via-pink-500/20 to-purple-500/30", name: "日落" },
  { id: "ocean", gradient: "from-blue-500/30 via-cyan-500/20 to-teal-500/30", name: "海洋" },
  { id: "forest", gradient: "from-green-500/30 via-emerald-500/20 to-lime-500/30", name: "森林" },
  { id: "galaxy", gradient: "from-purple-600/40 via-indigo-500/30 to-blue-600/40", name: "星空" },
  { id: "fire", gradient: "from-red-500/40 via-orange-500/30 to-yellow-500/40", name: "烈焰" },
  { id: "aurora", gradient: "from-green-400/30 via-blue-500/30 to-purple-500/30", name: "极光" },
  { id: "gold", gradient: "from-yellow-400/40 via-amber-500/30 to-orange-400/40", name: "黄金" },
];

export const rarityColors: Record<string, string> = {
  common: "text-gray-400", rare: "text-blue-400", epic: "text-purple-400",
  legendary: "text-yellow-400", mythology: "text-red-400",
};

export const rarityLabels: Record<string, string> = {
  common: "普通", rare: "稀有", epic: "史诗", legendary: "传说", mythology: "神话",
};

export interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  rarity: string;
  equipped_slot?: number | null;
}

export interface NameCardData {
  id: string;
  name: string;
  description: string;
  background_gradient: string;
  icon: string;
  category: string;
  rarity: string;
  is_equipped: boolean;
  is_owned: boolean;
  rank_position?: number | null;
}

export interface BestRecords {
  bestWinStreak: number;
  bestRankTier: RankTier;
  bestRankStars: number;
}

export const getUnlockCondition = (card: NameCardData): string => {
  if (card.category === "leaderboard_wins") return "排位胜利榜前10名";
  if (card.category === "leaderboard_xp") return "经验值榜前10名";
  if (card.category === "leaderboard_coins") return "狄邦豆榜前10名";
  if (card.category === "special") return "内测用户专属";
  if (card.description?.includes("解锁")) return card.description;
  return card.description || "特殊方式获取";
};
