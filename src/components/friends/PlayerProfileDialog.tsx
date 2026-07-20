import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge as UIBadge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Trophy, Sparkles, Swords, Coins, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  profileId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileData {
  id: string;
  username: string;
  avatar_url: string | null;
  grade: number;
  level: number;
  total_xp: number;
  coins: number;
  rank_tier: string;
  rank_stars: number;
  rank_points: number;
  wins: number;
  losses: number;
  free_match_wins: number;
  free_match_losses: number;
  streak: number;
  max_combo: number;
  ranked_wins: number;
  perfect_clears: number;
}

interface OwnedBadge {
  id: string;
  earned_at: string;
  equipped_slot: number | null;
  badge: { id: string; name: string; description: string | null; icon: string | null; rarity: string | null };
}

interface OwnedCard {
  id: string;
  is_equipped: boolean;
  earned_at: string;
  card: { id: string; name: string; description: string | null; icon: string | null; rarity: string | null; background_gradient: string | null };
}

const rarityColor: Record<string, string> = {
  common: "text-slate-300 border-slate-500/40 bg-slate-500/10",
  rare: "text-blue-300 border-blue-500/40 bg-blue-500/10",
  epic: "text-purple-300 border-purple-500/40 bg-purple-500/10",
  legendary: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  mythology: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

const tierName: Record<string, string> = {
  bronze: "青铜", silver: "白银", gold: "黄金",
  platinum: "铂金", diamond: "钻石", champion: "冠军",
};

export const PlayerProfileDialog = ({ profileId, open, onOpenChange }: Props) => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [badges, setBadges] = useState<OwnedBadge[]>([]);
  const [cards, setCards] = useState<OwnedCard[]>([]);

  useEffect(() => {
    if (!open || !profileId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: p }, { data: b }, { data: c }] = await Promise.all([
        supabase.from("profiles")
          .select("id, username, avatar_url, grade, level, total_xp, coins, rank_tier, rank_stars, rank_points, wins, losses, free_match_wins, free_match_losses, streak, max_combo, ranked_wins, perfect_clears")
          .eq("id", profileId).maybeSingle(),
        supabase.from("user_badges")
          .select("id, earned_at, equipped_slot, badge:badges(id, name, description, icon, rarity)")
          .eq("profile_id", profileId)
          .order("earned_at", { ascending: false }),
        supabase.from("user_name_cards")
          .select("id, is_equipped, earned_at, card:name_cards(id, name, description, icon, rarity, background_gradient)")
          .eq("profile_id", profileId)
          .order("earned_at", { ascending: false }),
      ]);
      if (cancelled) return;
      setProfile(p as ProfileData | null);
      setBadges((b as any) || []);
      setCards((c as any) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, profileId]);

  const equippedCard = cards.find(c => c.is_equipped)?.card;
  const equippedBadges = badges.filter(b => b.equipped_slot !== null).sort((a, b) => (a.equipped_slot! - b.equipped_slot!));
  const winRate = profile ? Math.round((profile.wins / Math.max(1, profile.wins + profile.losses)) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>玩家主页</DialogTitle>
        </DialogHeader>

        {loading || !profile ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header card */}
            <div
              className="relative rounded-xl p-4 border border-border/50 overflow-hidden"
              style={equippedCard?.background_gradient ? { background: equippedCard.background_gradient } : undefined}
            >
              <div className={cn("absolute inset-0", !equippedCard && "bg-gradient-to-br from-primary/20 to-accent/10")} />
              <div className="relative flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-background/40 backdrop-blur flex items-center justify-center text-2xl font-bold overflow-hidden ring-2 ring-white/30">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
                  ) : profile.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-lg font-bold text-white drop-shadow-md truncate">{profile.username}</div>
                  {equippedCard && (
                    <div className="text-xs text-white/90 drop-shadow flex items-center gap-1 mt-0.5">
                      {equippedCard.icon && <span>{equippedCard.icon}</span>}
                      <span>{equippedCard.name}</span>
                    </div>
                  )}
                  <div className="text-xs text-white/80 drop-shadow mt-1">
                    {profile.grade}年级 · Lv.{profile.level} · {tierName[profile.rank_tier] || profile.rank_tier} {profile.rank_stars}★
                  </div>
                </div>
              </div>
            </div>

            {/* Equipped badges */}
            {equippedBadges.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-2">佩戴的徽章</div>
                <div className="flex gap-2 flex-wrap">
                  {equippedBadges.map(b => (
                    <div key={b.id} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs", rarityColor[b.badge.rarity || "common"])} title={b.badge.description || ""}>
                      {b.badge.icon && <span>{b.badge.icon}</span>}
                      <span>{b.badge.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile icon={<Swords className="h-4 w-4" />} label="排位胜" value={profile.wins} />
              <StatTile icon={<Trophy className="h-4 w-4" />} label="胜率" value={`${winRate}%`} />
              <StatTile icon={<Flame className="h-4 w-4" />} label="最高连击" value={profile.max_combo} />
              <StatTile icon={<Coins className="h-4 w-4" />} label="累计豆" value={profile.coins} />
            </div>

            {/* Tabs */}
            <Tabs defaultValue="badges">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="badges">徽章 ({badges.length})</TabsTrigger>
                <TabsTrigger value="cards">名片 ({cards.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="badges" className="mt-3">
                {badges.length === 0 ? (
                  <EmptyState text="还没有徽章" />
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                    {badges.map(b => (
                      <div key={b.id} className={cn("flex items-center gap-2 p-2 rounded-md border", rarityColor[b.badge.rarity || "common"])}>
                        <div className="text-xl">{b.badge.icon || "🏅"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{b.badge.name}</div>
                          {b.badge.description && (
                            <div className="text-[10px] text-muted-foreground truncate">{b.badge.description}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="cards" className="mt-3">
                {cards.length === 0 ? (
                  <EmptyState text="还没有名片" />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                    {cards.map(c => (
                      <div
                        key={c.id}
                        className="relative rounded-md border border-border/50 p-2.5 overflow-hidden"
                        style={c.card.background_gradient ? { background: c.card.background_gradient } : undefined}
                      >
                        <div className="relative flex items-center gap-2">
                          <div className="text-xl">{c.card.icon || "✨"}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-white drop-shadow truncate flex items-center gap-1">
                              {c.card.name}
                              {c.is_equipped && <Sparkles className="h-3 w-3 text-yellow-300" />}
                            </div>
                            <div className="text-[10px] text-white/80 drop-shadow uppercase">{c.card.rarity}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const StatTile = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div className="rounded-md border border-border/50 bg-muted/30 p-2">
    <div className="flex items-center gap-1 text-muted-foreground text-[10px]">{icon}<span>{label}</span></div>
    <div className="text-sm font-semibold mt-0.5">{value}</div>
  </div>
);

const EmptyState = ({ text }: { text: string }) => (
  <div className="text-center py-8 text-sm text-muted-foreground">{text}</div>
);

export default PlayerProfileDialog;
