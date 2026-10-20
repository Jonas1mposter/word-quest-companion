/** Presentation-only identities; database achievement IDs and unlock rules stay unchanged. */
export const achievementIcons: Readonly<Record<string, string>> = {
  "排位大师": "Swords",
  "词汇学者": "BookOpenCheck",
  "淘金客": "Coins",
  "完美主义者": "Target",
  "日积月累": "CalendarDays",
  "坚持不懈": "Flame",
  "勇攀高峰": "Compass",
  "声名远扬": "RadioTower",
  "至高巅峰": "MountainSnow",
  "机械终结者": "Sword",
  "Bonjour!": "HandMetal",
  "GOAT": "Clover",
  "人机初胜": "Bot",
  "人机噩梦": "BotOff",
  "以文会友": "Handshake",
  "优先特权": "BadgeCheck",
  "全勤传奇": "CalendarCheck2",
  "初出茅庐": "Sprout",
  "初识词汇": "BookOpen",
  "千胜传说": "Trophy",
  "双冠王": "Medal",
  "双子星": "Orbit",
  "声声入耳": "AudioLines",
  "大满贯": "Award",
  "学贯中西": "Library",
  "富甲一方": "Landmark",
  "巅峰之证": "Crown",
  "开箱惊喜": "PackageOpen",
  "收藏大亨": "GalleryVerticalEnd",
  "无懈可击": "ShieldCheck",
  "无限进步": "Infinity",
  "星耀之证": "Sparkles",
  "狄邦单词通开发团队": "Code",
  "王牌之证": "Rocket",
  "登峰造极": "Mountain",
  "百万英镑": "Banknote",
  "社区贡献者": "Lightbulb",
  "经验之神": "TrendingUp",
  "连击之神": "Timer",
  "钻石之证": "Gem",
  "铂金之证": "Shield",
  "降维打击": "Zap",
  "首战告捷": "Flag",
};

export const achievementSeries = [
  "排位大师", "词汇学者", "淘金客", "完美主义者", "日积月累",
  "坚持不懈", "勇攀高峰", "声名远扬", "至高巅峰", "机械终结者",
] as const;

export function resolveAchievementIcon(name: string | undefined, storedIcon: string): string {
  if (!name) return storedIcon;
  // Only explicitly declared upgrade families may share an icon.
  const base = name.replace(/\s+(?:IV|III|II|I)$/, "");
  const key = achievementSeries.some(series => series === base) ? base : name;
  return achievementIcons[key] ?? storedIcon;
}