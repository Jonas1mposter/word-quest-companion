import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useBadgeChecker } from "@/hooks/useBadgeChecker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BadgeIcon } from "@/components/ui/badge-icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Award, Lock, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { getBadgeCriteria, getBadgeCriteriaFun } from "@/lib/badgeCriteria";

interface BadgeItem {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  category: string;
  rarity: string;
  earned?: boolean;
  earnedAt?: string;
}

const rarityColors: Record<string, string> = {
  common: "from-slate-500 to-slate-700",
  rare: "from-blue-500 to-blue-700",
  epic: "from-purple-500 to-purple-700",
  legendary: "from-amber-400 to-orange-600",
  mythology: "from-rose-500 via-red-600 to-red-800",
  hidden: "from-rose-500 via-amber-400 via-emerald-400 via-cyan-400 to-violet-500",
};

const rarityRing: Record<string, string> = {
  common: "ring-slate-400/40",
  rare: "ring-blue-400/60",
  epic: "ring-purple-400/60",
  legendary: "ring-amber-400/70",
  mythology: "ring-rose-500/80",
  hidden: "ring-cyan-300/70",
};

const rarityLabels: Record<string, string> = {
  common: "普通", rare: "稀有", epic: "史诗", legendary: "传说", mythology: "神话", hidden: "隐藏",
};

// tier metadata for series categories
const tierSeries: Record<
  string,
  { title: string; metric: keyof any; thresholds: [number, number, number, number]; unit: string; unitBefore?: boolean }
> = {
  tier_rank: { title: "排位大师", metric: "ranked_wins", thresholds: [10, 50, 100, 500], unit: "场排位胜" },
  tier_words: { title: "词汇学者", metric: "__mastered_words", thresholds: [10, 100, 500, 1000], unit: "个已掌握单词" },
  tier_coins: { title: "淘金客", metric: "lifetime_coins_earned", thresholds: [500, 1000, 5000, 10000], unit: "累计狄邦豆" },
  tier_perfect: { title: "完美主义者", metric: "perfect_clears", thresholds: [1, 10, 50, 100], unit: "次完美通关" },
  tier_login_total: { title: "日积月累", metric: "total_login_days", thresholds: [10, 50, 100, 365], unit: "天累计登录" },
  tier_streak: { title: "坚持不懈", metric: "streak", thresholds: [3, 10, 50, 100], unit: "天连续登录" },
  tier_xp: { title: "勇攀高峰", metric: "total_xp", thresholds: [100, 500, 1000, 5000], unit: "点累计经验" },
  tier_leaderboard: { title: "声名远扬", metric: "leaderboard_appearances", thresholds: [1, 5, 10, 20], unit: "次登榜" },
};

const groupOrder = [
  "tier_rank",
  "tier_words",
  "tier_coins",
  "tier_perfect",
  "tier_login_total",
  "tier_streak",
  "tier_xp",
  "tier_leaderboard",
  "special",
  "common",
];

const groupTitles: Record<string, string> = {
  ...Object.fromEntries(Object.entries(tierSeries).map(([k, v]) => [k, v.title])),
  special: "特殊荣誉",
  common: "起航",
};

const romanIdx = (name: string) => {
  if (/\bIV\b/.test(name)) return 3;
  if (/\bIII\b/.test(name)) return 2;
  if (/\bII\b/.test(name)) return 1;
  if (/\bI\b/.test(name)) return 0;
  return 0;
};

const formatEarnedDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
};

const BadgeDisplay = () => {
  const { profile } = useAuth();
  const { checkAndAwardBadges } = useBadgeChecker(profile);
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [masteredWords, setMasteredWords] = useState(0);

  const fetchBadges = useCallback(async () => {
    const { data: allBadges, error } = await supabase.from("badges").select("*");
    if (error) { setLoading(false); return; }

    let earnedMap: Record<string, string> = {};
    if (profile) {
      const { data: ubs } = await supabase
        .from("user_badges").select("badge_id, earned_at").eq("profile_id", profile.id);
      ubs?.forEach(u => { earnedMap[u.badge_id] = u.earned_at; });

      const { count } = await supabase
        .from("learning_progress")
        .select("*", { count: "exact", head: true })
        .eq("profile_id", profile.id)
        .gte("mastery_level", 3);
      setMasteredWords(count ?? 0);
    }

    const merged: BadgeItem[] = (allBadges || []).map(b => ({
      ...b,
      earned: b.id in earnedMap,
      earnedAt: earnedMap[b.id],
    }));
    setBadges(merged);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (profile?.id) {
        try { await supabase.rpc("record_daily_login" as any); } catch {}
        await checkAndAwardBadges();
      }
      if (!cancelled) await fetchBadges();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkAndAwardBadges();
    await fetchBadges();
    setRefreshing(false);
  };

  // group badges by category
  const grouped = useMemo(() => {
    const g: Record<string, BadgeItem[]> = {};
    for (const b of badges) {
      const key = groupTitles[b.category] ? b.category : (b.category in tierSeries ? b.category : "special");
      (g[key] ||= []).push(b);
    }
    // sort tier series by roman index; others by rarity
    Object.keys(g).forEach(k => {
      if (k in tierSeries) g[k].sort((a, b) => romanIdx(a.name) - romanIdx(b.name));
      else g[k].sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    });
    return g;
  }, [badges]);

  const getMetricValue = useCallback((metric: string): number => {
    if (metric === "__mastered_words") return masteredWords;
    return Number((profile as any)?.[metric] ?? 0);
  }, [profile, masteredWords]);

  const earnedCount = badges.filter(b => b.earned).length;

  // pick a default selection
  useEffect(() => {
    if (!selectedId && badges.length) {
      const firstEarned = badges.find(b => b.earned);
      setSelectedId((firstEarned ?? badges[0]).id);
    }
  }, [badges, selectedId]);

  const selected = badges.find(b => b.id === selectedId) || null;

  // build tier progression info for selected badge if in a tier series
  const tierInfo = useMemo(() => {
    if (!selected) return null;
    const series = tierSeries[selected.category];
    if (!series) return null;
    const siblings = grouped[selected.category] || [];
    const currentIdx = romanIdx(selected.name);
    const value = getMetricValue(series.metric as string);
    const target = series.thresholds[currentIdx];
    const prev = currentIdx === 0 ? 0 : series.thresholds[currentIdx - 1];
    const pct = Math.min(100, Math.max(0, ((value - prev) / Math.max(1, target - prev)) * 100));
    return { series, siblings, currentIdx, value, target, prev, pct };
  }, [selected, grouped, getMetricValue]);

  if (loading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-6 flex items-center justify-center h-32">
          <div className="animate-pulse text-muted-foreground">加载中...</div>
        </CardContent>
      </Card>
    );
  }

  const visibleGroupKeys = groupOrder.filter(k => grouped[k]?.length);

  return (
    <Card className="bg-card/60 backdrop-blur-sm border-border/50 overflow-hidden">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Award className="h-5 w-5 text-primary" />
            成就勋章
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing} className="h-8 px-2">
              <RefreshCw className={cn("h-4 w-4 mr-1", refreshing && "animate-spin")} />
              {refreshing ? "检查中" : "刷新"}
            </Button>
            <Badge variant="secondary" className="text-xs">
              {earnedCount}/{badges.length} 已获得
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px]">
          {/* LEFT: category groups */}
          <div className="max-h-[560px] overflow-y-auto p-3 space-y-3 border-r border-border/40">
            {visibleGroupKeys.map(key => {
              const list = grouped[key];
              const earned = list.filter(b => b.earned).length;
              const pct = Math.round((earned / list.length) * 100);
              const isCollapsed = collapsed[key];
              return (
                <div key={key} className="rounded-lg border border-border/40 bg-muted/20 overflow-hidden">
                  <button
                    onClick={() => setCollapsed(s => ({ ...s, [key]: !s[key] }))}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition"
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-semibold flex-1 text-left">{groupTitles[key]}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
                  </button>
                  {!isCollapsed && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 p-3 pt-1">
                      {list.map(b => {
                        const isSel = b.id === selectedId;
                        return (
                          <button
                            key={b.id}
                            onClick={() => setSelectedId(b.id)}
                            className={cn(
                              "relative aspect-square rounded-md flex items-center justify-center transition-all",
                              "ring-2 ring-transparent hover:ring-primary/50",
                              isSel && "ring-primary shadow-lg scale-105",
                              b.earned
                                ? `bg-gradient-to-br ${rarityColors[b.rarity]} ${rarityRing[b.rarity]}`
                                : "bg-muted/60 grayscale opacity-60"
                            )}
                            title={b.name}
                          >
                            {b.earned ? (
                              <BadgeIcon icon={b.icon} className="h-6 w-6 text-white drop-shadow" />
                            ) : (
                              <>
                                <BadgeIcon icon={b.icon} className="h-6 w-6 text-muted-foreground/70" />
                                <Lock className="absolute top-0.5 right-0.5 h-3 w-3 text-muted-foreground" />
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* RIGHT: detail panel */}
          <div className="p-4 bg-gradient-to-br from-background/50 to-muted/30 min-h-[400px]">
            {selected ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "h-12 w-12 rounded-md flex items-center justify-center bg-gradient-to-br",
                    rarityColors[selected.rarity]
                  )}>
                    <BadgeIcon icon={selected.icon} className="h-7 w-7 text-white drop-shadow" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold leading-tight">{selected.name}</h3>
                    <Badge variant="outline" className="text-[10px] mt-1">{rarityLabels[selected.rarity]}</Badge>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground italic border-l-2 border-primary/50 pl-3">
                  {getBadgeCriteriaFun(selected.name, selected.description)}
                </p>

                {/* Tier progression */}
                {tierInfo && (
                  <div className="flex items-center justify-between gap-1">
                    {tierInfo.series.thresholds.map((_, i) => {
                      const sib = tierInfo.siblings[i];
                      if (!sib) return null;
                      const isCurrent = sib.id === selected.id;
                      const isEarned = sib.earned;
                      return (
                        <div key={i} className="flex items-center gap-1 flex-1">
                          <button
                            onClick={() => setSelectedId(sib.id)}
                            className={cn(
                              "flex-1 flex flex-col items-center gap-1 p-1 rounded transition",
                              isCurrent && "bg-primary/10 ring-1 ring-primary/50"
                            )}
                          >
                            <div className={cn(
                              "h-10 w-10 rounded-md flex items-center justify-center bg-gradient-to-br relative",
                              isEarned ? rarityColors[sib.rarity] : "from-muted to-muted"
                            )}>
                              <BadgeIcon
                                icon={sib.icon}
                                className={cn("h-5 w-5", isEarned ? "text-white" : "text-muted-foreground/50")}
                              />
                              {!isEarned && (
                                <Lock className="absolute -bottom-0.5 -right-0.5 h-3 w-3 text-muted-foreground bg-background rounded-full p-0.5" />
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {isEarned ? "" : "🔒"}lv.{i + 1}
                            </span>
                          </button>
                          {i < tierInfo.series.thresholds.length - 1 && (
                            <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Unlock condition */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground/80">解锁条件</h4>
                  <div className="text-xs text-muted-foreground">
                    {getBadgeCriteria(selected.name, selected.description)}
                  </div>

                  {tierInfo ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="text-muted-foreground">
                          {tierInfo.value} / {tierInfo.target} {tierInfo.series.unit}
                        </span>
                        <span className="text-primary font-semibold">
                          {Math.round(tierInfo.pct)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full bg-gradient-to-r transition-all",
                            rarityColors[selected.rarity]
                          )}
                          style={{ width: `${tierInfo.pct}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] tabular-nums">
                        <span className="text-muted-foreground">{selected.earned ? "已完成" : "未达成"}</span>
                        <span className="text-primary font-semibold">{selected.earned ? "100%" : "0%"}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full bg-gradient-to-r", rarityColors[selected.rarity])}
                          style={{ width: selected.earned ? "100%" : "0%" }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {selected.earned && selected.earnedAt && (
                  <div className="text-[11px] text-primary/80 pt-2 border-t border-border/40">
                    ✓ 解锁于 {formatEarnedDate(selected.earnedAt)}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-sm text-muted-foreground py-16">
                选择一枚勋章以查看详情
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BadgeDisplay;
