import { useRef, useState } from "react";
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
import { discountRemaining, pityRemaining, lotteryTiers, type LotteryState } from "@/lib/lottery-policy";

const RARITY_LABEL: Record<string, string> = { epic: "史诗", legendary: "传说", mythology: "神话" };

export default function Lottery() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [rolling, setRolling] = useState(false);
  const [buying, setBuying] = useState(false);
  const actionLock = useRef(false);
  const [result, setResult] = useState<{ kind: string; label: string }[] | null>(null);
  const { data: state } = useQuery<LotteryState>({
    queryKey: ["lottery-state", profile?.id],
    enabled: !!profile,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_lottery_state", { p_pool_id: "champions-2024" });
      if (error) throw error;
      return data as unknown as LotteryState;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["lottery", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      if (!profile) return { tickets: [], cards: [], pack: null, owned: new Set<string>() };
      const [tickets, cards, pack, ownedCards, ownedPack] = await Promise.all([
        supabase.from("backpack_items" as any).select("id").eq("profile_id", profile.id)
          .eq("item_type", "lottery_ticket").eq("status", "unused").or("lottery_pool_id.is.null,lottery_pool_id.eq.champions-2024").order("created_at"),
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
  const remaining = state ? discountRemaining(state) : 0;
  const pity = state ? pityRemaining(state) : null;
  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["lottery"] }),
      qc.invalidateQueries({ queryKey: ["lottery-state"] }),
      qc.invalidateQueries({ queryKey: ["backpack"] }),
      qc.invalidateQueries({ queryKey: ["lottery-ticket-count"] }),
      refreshProfile(),
    ]);
  };

  const buyTicket = async (discounted: boolean) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBuying(true);
    try {
      const { data: response, error } = await supabase.rpc("purchase_lottery_ticket", { p_pool_id: "champions-2024", p_discounted: discounted });
      const r = response as { error?: string; price?: number } | null;
      if (error) throw error;
      if (r?.error) {
        toast.error(r.error === "discount_limit" ? "本奖池十次优惠已用完" : r.error === "insufficient_coins" ? "狄邦豆不足" : "兑换失败，请重试");
      } else {
        toast.success(`已用 ${r?.price} 狄邦豆兑换 1 张抽奖券`);
      }
      await invalidate();
    } catch {
      toast.error("兑换未能确认，请刷新查看余额和抽奖券后重试");
    } finally {
      actionLock.current = false;
      setBuying(false);
    }
  };

  const roll = async (count = 1) => {
    const n = Math.min(count, tickets.length);
    if (!n || actionLock.current) return;
    actionLock.current = true; setRolling(true);
    const got: { kind: string; label: string }[] = [];
    try {
      const delay = new Promise((r) => setTimeout(r, 1800));
      // 逐张开奖：每张券由服务器单独判定，保底计数照常累加
      for (const t of tickets.slice(0, n)) {
        const res = await supabase.rpc("use_backpack_item" as any, { p_item_id: t.id });
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
    finally { actionLock.current = false; setRolling(false); }
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
                <div className="text-xs text-primary font-bold">大奖 · {state ? `${state.sound_pct}%` : "加载中"}{state?.promotion_active ? " · 限时提升" : ""}</div>
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
          {state?.promotion_active && (
            <div className="text-center space-y-1">
              <p className="text-sm text-primary">限时音效概率 4% · 25 抽保底</p>
              <p className="text-xs text-muted-foreground">截至北京时间 2026年10月31日 23:59；仅统计活动期间抽奖</p>
              <p className="text-sm font-medium">{pity === null ? "已拥有冠军音效" : `最多再抽 ${pity} 次必得冠军音效`}</p>
            </div>
          )}
          <div className="grid w-full sm:max-w-xl grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="gold" disabled={!state || buying || rolling || remaining === 0 || (profile?.coins ?? 0) < (state?.discount_price ?? 150)} onClick={() => buyTicket(true)}>
              {buying ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Coins className="w-4 h-4 mr-2" />}
              {state?.discount_price ?? 150} 豆兑券 · 剩 {remaining}/10 次
            </Button>
            <Button variant="outline" disabled={!state || buying || rolling || (profile?.coins ?? 0) < (state?.standard_price ?? 200)} onClick={() => buyTicket(false)}>
              <Coins className="w-4 h-4 mr-2" />{state?.standard_price ?? 200} 豆兑券 · 不限购
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">余额 {profile?.coins ?? 0} 狄邦豆 · 每个账号每个奖池享十次优惠；兑券不自动抽奖</p>
          <div className="grid w-full sm:max-w-xl grid-cols-1 sm:grid-cols-2 gap-3">
            <Button size="lg" variant="hero" className="h-14 text-lg" disabled={rolling || buying || isLoading || !tickets.length} onClick={() => roll(1)}>
              {rolling ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Ticket className="w-5 h-5 mr-2" />}
              {rolling ? "开奖中..." : tickets.length ? "单抽 · 1 张券" : "没有抽奖券"}
            </Button>
            <Button size="lg" variant="gold" className="h-14 text-lg" disabled={rolling || buying || isLoading || tickets.length < 10} onClick={() => roll(10)}>
              <Sparkles className="w-5 h-5 mr-2" />十连抽 · 10 张券
            </Button>
          </div>
          {!tickets.length && <p className="text-xs text-muted-foreground">也可通过优先账户每周奖励获得抽奖券</p>}
        </div>

        <Card><CardContent className="p-4 space-y-1 text-sm">
          <p className="font-medium mb-2">概率公示</p>
          {state ? lotteryTiers(state.sound_pct).map((t) => (
            <div key={t.label} className="flex justify-between gap-3"><span className="text-muted-foreground">{t.label}</span><span className="font-mono">{t.pct}%</span></div>
          )) : <p className="text-muted-foreground">概率加载中…</p>}
          {state?.promotion_active && <p className="text-xs text-muted-foreground pt-2">以上为非保底抽奖概率；未拥有音效时第25抽保底优先。活动结束恢复音效1%、100豆50%，其他不变；已获得音效永久保留。</p>}
          <p className="text-xs text-muted-foreground pt-2">已拥有的名片或音效不会重复，改发 200 狄邦豆。</p>
        </CardContent></Card>
      </div>

      <Dialog open={!!result} onOpenChange={(o) => !o && setResult(null)}>
        <DialogContent className={cn("text-center", (result?.length ?? 0) > 1 ? "max-w-2xl" : "max-w-sm")}>
          <DialogHeader><DialogTitle className="flex items-center justify-center gap-2"><Sparkles className="w-5 h-5 text-primary" />恭喜获得</DialogTitle></DialogHeader>
          <div className={cn("py-4 nc-flip", (result?.length ?? 0) > 1 ? "grid grid-cols-2 sm:grid-cols-5 gap-2" : "flex flex-col items-center gap-3")}>
            {result?.map((it, i) => (
              <div key={i} className={cn("flex flex-col items-center gap-2", (result?.length ?? 0) > 1 && "rounded-lg border border-border p-2")}>
                {it.kind === "coins" ? <Coins className={cn("text-yellow-400", result!.length > 1 ? "w-8 h-8" : "w-16 h-16")} /> : it.kind === "sound_pack" ? <Trophy className={cn("text-primary", result!.length > 1 ? "w-8 h-8" : "w-16 h-16")} /> : <Sparkles className={cn("text-primary", result!.length > 1 ? "w-8 h-8" : "w-16 h-16")} />}
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
