import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, Ticket, Coins, Loader2, Sparkles, Trophy, Crown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BadgeIcon } from "@/components/ui/badge-icon";
import { getNameCardGradientStyle } from "@/components/profile-card/utils";
import { gloryPityRemaining, gloryTiers, type GloryCrownState } from "@/lib/glory-crown-policy";

const POOL = "glory-crown";
const MAIN = ["champions2021", "recon"];
const SUB = ["champions2025", "mystbloom", "sovereign"];
const RARITY_LABEL: Record<string, string> = { legendary: "传说", mythology: "神话" };

export default function GloryCrownLottery() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [rolling, setRolling] = useState(false);
  const [buying, setBuying] = useState(false);
  const lock = useRef(false);
  const [result, setResult] = useState<{ kind: string; label: string }[] | null>(null);

  const { data: state } = useQuery<GloryCrownState>({
    queryKey: ["lottery-state", POOL, profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_lottery_state", { p_pool_id: POOL });
      if (error) throw error;
      return data as unknown as GloryCrownState;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["lottery", POOL, profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      if (!profile) return null;
      const [tickets, cards, packs, ownedCards, ownedPacks] = await Promise.all([
        supabase.from("backpack_items" as any).select("id").eq("profile_id", profile.id)
          .eq("item_type", "lottery_ticket").eq("status", "unused")
          .or(`lottery_pool_id.is.null,lottery_pool_id.eq.${POOL}`).order("created_at"),
        supabase.from("name_cards").select("*").eq("category", "lottery_glory"),
        supabase.from("kill_sound_packs").select("*").in("code", [...MAIN, ...SUB]),
        supabase.from("user_name_cards").select("name_card_id").eq("profile_id", profile.id),
        supabase.from("user_kill_sound_packs").select("pack_id").eq("profile_id", profile.id),
      ]);
      return {
        tickets: (tickets.data as any[]) ?? [],
        cards: cards.data ?? [],
        packs: (packs.data as any[]) ?? [],
        owned: new Set([...(ownedCards.data ?? []).map((o: any) => o.name_card_id), ...(ownedPacks.data ?? []).map((o: any) => o.pack_id)]),
      };
    },
  });

  const tickets = data?.tickets ?? [];
  const pity = state ? gloryPityRemaining(state) : null;
  const remaining = state ? Math.max(0, state.discount_limit - state.discounted_purchases) : 0;
  const invalidate = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["lottery"] }),
    qc.invalidateQueries({ queryKey: ["lottery-state"] }),
    qc.invalidateQueries({ queryKey: ["backpack"] }),
    qc.invalidateQueries({ queryKey: ["lottery-ticket-count"] }),
    refreshProfile(),
  ]);

  const buy = async (discounted: boolean) => {
    if (lock.current) return;
    lock.current = true; setBuying(true);
    try {
      const { data: r, error } = await supabase.rpc("purchase_lottery_ticket", { p_pool_id: POOL, p_discounted: discounted });
      if (error) throw error;
      const res = r as { error?: string; price?: number } | null;
      if (res?.error) toast.error(res.error === "discount_limit" ? "本奖池十次优惠已用完" : res.error === "insufficient_coins" ? "狄邦豆不足" : "兑换失败，请重试");
      else toast.success(`已用 ${res?.price} 狄邦豆兑换 1 张荣光铸冠抽奖券`);
      await invalidate();
    } catch { toast.error("兑换未能确认，请刷新查看余额后重试"); }
    finally { lock.current = false; setBuying(false); }
  };

  const roll = async (count = 1) => {
    const n = Math.min(count, tickets.length);
    if (!n || lock.current) return;
    lock.current = true; setRolling(true);
    const got: { kind: string; label: string }[] = [];
    try {
      const delay = new Promise((r) => setTimeout(r, 1800));
      // 逐张开奖：每张券由服务器单独判定，保底计数照常累加
      for (const t of tickets.slice(0, n)) {
        const res = await supabase.rpc("glory_crown_draw" as any, { p_item_id: t.id });
        const r = res.data as any;
        if (res.error || r?.error) break;
        got.push({ kind: r.kind, label: r.label });
      }
      await delay;
      if (!got.length) toast.error("抽奖失败，请重试");
      else {
        if (got.length < n) toast.error(`已完成 ${got.length} 抽，其余未能开奖，券未扣除`);
        setResult(got);
      }
      await invalidate();
    } catch { toast.error(got.length ? `已完成 ${got.length} 抽，请刷新查看奖励` : "开奖结果未能确认，请刷新查看奖励"); if (got.length) setResult(got); }
    finally { lock.current = false; setRolling(false); }
  };


  const packs = data?.packs ?? [];
  const order = (c: string) => [...MAIN, ...SUB].indexOf(c);
  const cards = [...(data?.cards ?? [])].sort((a: any, b: any) => (a.rarity === b.rarity ? 0 : a.rarity === "mythology" ? -1 : 1));

  const PackRow = ({ list, label, pct }: { list: any[]; label: string; pct?: number }) => (
    <div className="space-y-2">
      <div className="text-xs font-bold text-primary">{label}{pct !== undefined ? ` · ${pct}%` : ""}</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {list.map((p) => (
          <Card key={p.id} className={cn("border-primary/50", rolling && "animate-pulse")}>
            <CardContent className="p-4 flex items-center gap-3">
              <img src={p.icon_url} alt={p.name} className="w-14 h-14 object-contain" />
              <div className="flex-1 min-w-0">
                <div className="font-gaming truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">6 段连杀语音</div>
              </div>
              {data?.owned.has(p.id) && <span className="text-xs text-muted-foreground">已拥有</span>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background bg-grid-pattern p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/lottery")}><ChevronLeft className="w-4 h-4 mr-1" />抽奖大厅</Button>
          <div className="flex items-center gap-2 font-gaming">
            <Ticket className="w-5 h-5 text-primary" /><span className="text-primary">{tickets.length}</span>
            <span className="text-muted-foreground text-sm">张可用抽奖券</span>
          </div>
        </header>

        <Card className="overflow-hidden border-primary/40 bg-gradient-to-br from-primary/15 via-transparent to-transparent">
          <CardContent className="p-6 space-y-2 text-center">
            <h1 className="text-3xl font-gaming flex items-center justify-center gap-2"><Crown className="w-8 h-8 text-primary" />荣光铸冠</h1>
            <p className="text-sm text-muted-foreground">常驻奖池 · 消耗 1 张抽奖券 · 5 套连杀音效与 10 张限定名片</p>
          </CardContent>
        </Card>

        <PackRow list={packs.filter((p) => MAIN.includes(p.code)).sort((a, b) => order(a.code) - order(b.code))} label="主套音效" pct={state?.main_pct} />
        <PackRow list={packs.filter((p) => SUB.includes(p.code)).sort((a, b) => order(a.code) - order(b.code))} label="副套音效" pct={state?.sub_pct} />

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {cards.map((c: any) => (
            <div key={c.id} className={cn("relative aspect-[3/4] rounded-xl overflow-hidden", rolling && "animate-pulse")}
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

        {pity && (
          <Card><CardContent className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
            <div><div className="text-xs text-muted-foreground">传说名片保底</div><div className="font-gaming text-lg">{pity.legendary} 抽</div></div>
            <div><div className="text-xs text-muted-foreground">神话名片保底</div><div className="font-gaming text-lg">{pity.mythology} 抽</div></div>
            <div><div className="text-xs text-muted-foreground">副套音效保底</div><div className="font-gaming text-lg">{pity.sub} 抽</div></div>
            <div><div className="text-xs text-muted-foreground">主套音效保底</div><div className="font-gaming text-lg">{pity.main} 抽</div></div>
          </CardContent></Card>
        )}

        <div className="flex flex-col items-center gap-3">
          <div className="grid w-full sm:max-w-xl grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="gold" disabled={!state || buying || rolling || remaining === 0 || (profile?.coins ?? 0) < (state?.discount_price ?? 150)} onClick={() => buy(true)}>
              {buying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coins className="w-4 h-4 mr-2" />}
              {state?.discount_price ?? 150} 豆兑券 · 剩 {remaining}/10 次
            </Button>
            <Button variant="outline" disabled={!state || buying || rolling || (profile?.coins ?? 0) < (state?.standard_price ?? 200)} onClick={() => buy(false)}>
              <Coins className="w-4 h-4 mr-2" />{state?.standard_price ?? 200} 豆兑券 · 不限购
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">余额 {profile?.coins ?? 0} 狄邦豆 · 本奖池独立十次优惠；这里兑的券只能在荣光铸冠使用</p>
          <div className="grid w-full sm:max-w-xl grid-cols-1 sm:grid-cols-2 gap-3">
            <Button size="lg" variant="hero" className="h-14 text-lg" disabled={rolling || buying || isLoading || !tickets.length} onClick={() => roll(1)}>
              {rolling ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Ticket className="w-5 h-5 mr-2" />}
              {rolling ? "铸造中..." : tickets.length ? "单抽 · 1 张券" : "没有抽奖券"}
            </Button>
            <Button size="lg" variant="gold" className="h-14 text-lg" disabled={rolling || buying || isLoading || tickets.length < 10} onClick={() => roll(10)}>
              <Sparkles className="w-5 h-5 mr-2" />十连抽 · 10 张券
            </Button>
          </div>
        </div>

        <Card><CardContent className="p-4 space-y-1 text-sm">
          <p className="font-medium mb-2">概率公示</p>
          {state ? gloryTiers(state).map((t) => (
            <div key={t.label} className="flex justify-between gap-3"><span className="text-muted-foreground">{t.label}</span><span className="font-mono">{t.pct}%</span></div>
          )) : <p className="text-muted-foreground">概率加载中…</p>}
          <p className="text-xs text-muted-foreground pt-2">保底：20 抽必出传说名片、25 抽必出神话名片、50 抽必得副套音效、100 抽必得主套音效；获得对应奖励后该保底重新计数。同时触发时按 主套 → 副套 → 神话 → 传说 顺序，其余保底顺延到下一抽。</p>
          <p className="text-xs text-muted-foreground">已拥有的名片或音效不会重复，优先发放未拥有的；该类全部拥有时改发 200 狄邦豆。</p>
        </CardContent></Card>
      </div>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className={cn("text-center", (result?.length ?? 0) > 1 ? "max-w-2xl" : "max-w-sm")}>
          <DialogHeader><DialogTitle className="flex items-center justify-center gap-2"><Sparkles className="w-5 h-5 text-primary" />恭喜获得</DialogTitle></DialogHeader>
          <div className={cn("py-4 nc-flip", (result?.length ?? 0) > 1 ? "grid grid-cols-2 sm:grid-cols-5 gap-2" : "flex flex-col items-center gap-3")}>
            {result?.map((it, i) => (
              <div key={i} className={cn("flex flex-col items-center gap-2", (result?.length ?? 0) > 1 && "rounded-lg border border-border p-2")}>
                {it.kind === "coins" ? <Coins className={cn("text-gold", result!.length > 1 ? "w-8 h-8" : "w-16 h-16")} /> : it.kind === "sound_pack" ? <Trophy className={cn("text-primary", result!.length > 1 ? "w-8 h-8" : "w-16 h-16")} /> : <Sparkles className={cn("text-primary", result!.length > 1 ? "w-8 h-8" : "w-16 h-16")} />}
                <div className={cn("font-gaming", result!.length > 1 ? "text-xs" : "text-2xl")}>{it.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">已直接加到你的账号</p>
          <DialogFooter className="sm:justify-center gap-2">
            {tickets.length > 0 && <Button onClick={() => { const n = result?.length ?? 1; setResult(null); roll(n); }} disabled={(result?.length ?? 1) > tickets.length}>{(result?.length ?? 1) > 1 ? "再来十连" : "再抽一次"}</Button>}
            <Button variant="outline" onClick={() => setResult(null)}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
