import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, Ticket, Coins, Loader2, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BadgeIcon } from "@/components/ui/badge-icon";
import { getNameCardGradientStyle } from "@/components/profile-card/utils";

const RARITY_LABEL: Record<string, string> = { epic: "史诗", legendary: "传说", mythology: "神话" };
const TIERS = [
  { label: "100 狄邦豆", pct: "50%" },
  { label: "200 狄邦豆", pct: "30%" },
  { label: "史诗/传说限定名片", pct: "15%" },
  { label: "神话限定名片", pct: "4%" },
  { label: "2024 全球冠军赛音效", pct: "1%" },
];

export default function Lottery() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<{ kind: string; label: string } | null>(null);

  const { data } = useQuery({
    queryKey: ["lottery", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      if (!profile) return { tickets: [], cards: [], pack: null, owned: new Set<string>() };
      const [tickets, cards, pack, ownedCards, ownedPack] = await Promise.all([
        supabase.from("backpack_items" as any).select("id").eq("profile_id", profile.id)
          .eq("item_type", "lottery_ticket").eq("status", "unused").order("created_at"),
        supabase.from("name_cards").select("*").eq("category", "lottery").order("rarity"),
        supabase.from("kill_sound_packs").select("*").eq("code", "champions2024").maybeSingle(),
        supabase.from("user_name_cards").select("name_card_id").eq("profile_id", profile.id),
        supabase.from("user_kill_sound_packs").select("pack_id").eq("profile_id", profile.id),
      ]);
      return {
        tickets: (tickets.data as any[]) ?? [],
        cards: cards.data ?? [],
        pack: pack.data as any,
        owned: new Set([...(ownedCards.data ?? []).map((o: any) => o.name_card_id), ...(ownedPack.data ?? []).map((o: any) => o.pack_id)]),
      };
    },
  });

  const tickets = data?.tickets ?? [];

  const roll = async () => {
    if (!tickets.length) return;
    setRolling(true);
    const [res] = await Promise.all([
      supabase.rpc("use_backpack_item" as any, { p_item_id: tickets[0].id }),
      new Promise((r) => setTimeout(r, 1800)),
    ]);
    setRolling(false);
    const r = res.data as any;
    if (res.error || r?.error) { toast.error("抽奖失败，请重试"); return; }
    setResult({ kind: r.kind, label: r.label });
    qc.invalidateQueries({ queryKey: ["lottery"] });
    qc.invalidateQueries({ queryKey: ["backpack"] });
    qc.invalidateQueries({ queryKey: ["lottery-ticket-count"] });
    refreshProfile();
  };

  const sorted = [...(data?.cards ?? [])].sort((a: any, b: any) => ["epic", "legendary", "mythology"].indexOf(a.rarity) - ["epic", "legendary", "mythology"].indexOf(b.rarity));

  return (
    <div className="min-h-screen bg-background bg-grid-pattern p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/lottery")}><ChevronLeft className="w-4 h-4 mr-1" />抽奖大厅</Button>
          <div className="flex items-center gap-2 font-gaming">
            <Ticket className="w-5 h-5 text-primary" />
            <span className="text-primary">{tickets.length}</span>
            <span className="text-muted-foreground text-sm">张抽奖券</span>
          </div>
        </header>

        <Card className="overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-transparent to-transparent">
          <CardContent className="p-6 space-y-2 text-center">
            <h1 className="text-3xl font-gaming flex items-center justify-center gap-2"><Trophy className="w-8 h-8 text-primary" />冠军限定抽奖</h1>
            <p className="text-sm text-muted-foreground">消耗 1 张抽奖券 · 限定名片与 2024 全球冠军赛音效只在这里出现</p>
          </CardContent>
        </Card>

        {/* 大奖 */}
        {data?.pack && (
          <Card className={cn("border-primary/60 overflow-hidden", rolling && "animate-pulse")}>
            <CardContent className="p-5 flex items-center gap-4">
              <img src={data.pack.icon_url} alt={data.pack.name} className="w-20 h-20 object-contain" />
              <div className="flex-1">
                <div className="text-xs text-primary font-bold tracking-widest">大奖 · 1%</div>
                <div className="text-xl font-gaming">{data.pack.name}</div>
                <div className="text-xs text-muted-foreground">6 段专属连杀语音</div>
              </div>
              {data.owned.has(data.pack.id) && <span className="text-xs text-muted-foreground">已拥有</span>}
            </CardContent>
          </Card>
        )}

        {/* 名片奖池 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {sorted.map((c: any) => (
            <div key={c.id} className={cn("relative aspect-[3/4] rounded-xl overflow-hidden transition-transform", rolling && "animate-pulse")}
              style={{ background: getNameCardGradientStyle(c.background_gradient) }}>
              <div className="relative z-10 flex h-full flex-col items-center justify-between p-3 text-center text-white">
                <span className="self-start rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-bold">{RARITY_LABEL[c.rarity]}</span>
                <BadgeIcon icon={c.icon} className="w-10 h-10 drop-shadow-lg" />
                <div className="font-gaming text-sm drop-shadow">{c.name}</div>
              </div>
              {data?.owned.has(c.id) && <div className="absolute inset-0 z-20 bg-black/50 flex items-center justify-center text-xs text-white">已拥有</div>}
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <Button size="lg" variant="hero" className="w-full sm:w-80 h-14 text-lg" disabled={rolling || !tickets.length} onClick={roll}>
            {rolling ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Ticket className="w-5 h-5 mr-2" />}
            {rolling ? "开奖中..." : tickets.length ? "使用 1 张抽奖券" : "没有抽奖券"}
          </Button>
          {!tickets.length && <p className="text-xs text-muted-foreground">抽奖券可通过优先账户每周奖励获得</p>}
        </div>

        <Card><CardContent className="p-4 space-y-1 text-sm">
          <p className="font-medium mb-2">概率公示</p>
          {TIERS.map((t) => (
            <div key={t.label} className="flex justify-between"><span className="text-muted-foreground">{t.label}</span><span className="font-mono">{t.pct}</span></div>
          ))}
          <p className="text-xs text-muted-foreground pt-2">已拥有的名片或音效不会重复，改发 200 狄邦豆。</p>
        </CardContent></Card>
      </div>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader><DialogTitle className="flex items-center justify-center gap-2"><Sparkles className="w-5 h-5 text-primary" />恭喜获得</DialogTitle></DialogHeader>
          <div className="py-6 flex flex-col items-center gap-3 nc-flip">
            {result?.kind === "coins" ? <Coins className="w-16 h-16 text-yellow-400" /> : result?.kind === "sound_pack" ? <Trophy className="w-16 h-16 text-primary" /> : <Sparkles className="w-16 h-16 text-primary" />}
            <div className="text-2xl font-gaming">{result?.label}</div>
            <p className="text-xs text-muted-foreground">已直接加到你的账号</p>
          </div>
          <DialogFooter className="sm:justify-center gap-2">
            {tickets.length > 0 && <Button onClick={() => { setResult(null); roll(); }}>再抽一次</Button>}
            <Button variant="outline" onClick={() => setResult(null)}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
