import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, Coins, Ticket, IdCard, Volume2, CupSoda, Backpack as BackpackIcon } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

const ICONS: Record<string, any> = { coins: Coins, lottery_ticket: Ticket, name_card: IdCard, sound_pack: Volume2, water_coupon: CupSoda };
const STATUS: Record<string, string> = { used: "已兑换", pending: "已提交，等待管理员兑换" };

export default function Backpack() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["backpack", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase.from("backpack_items" as any).select("*")
        .eq("profile_id", profile!.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const use = async (it: any) => {
    if (it.item_type === "water_coupon" && !confirm("使用水吧券？将通知管理员为你线下兑换。")) return;
    setBusy(it.id);
    const { data, error } = await supabase.rpc("use_backpack_item" as any, { p_item_id: it.id });
    setBusy(null);
    const r = data as any;
    if (error || r?.error) {
      toast.error("兑换失败，请重试");
      return;
    }
    toast.success(r?.pending ? "已通知管理员，请等待线下兑换" : r?.lottery ? `🎉 限定抽奖获得：${r.label}` : `已兑换：${it.label}`);
    qc.invalidateQueries({ queryKey: ["backpack"] });
    refreshProfile();
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}><ChevronLeft className="w-4 h-4 mr-1" />返回</Button>
          <h1 className="text-2xl font-gaming flex items-center gap-2"><BackpackIcon className="w-6 h-6 text-primary" />背包</h1>
        </header>
        <Card className="cursor-pointer border-primary/40 hover:border-primary" onClick={() => navigate("/lottery")}>
          <CardContent className="p-4 flex items-center gap-3">
            <Ticket className="w-7 h-7 text-primary" />
            <div className="flex-1"><p className="font-medium">冠军限定抽奖</p><p className="text-xs text-muted-foreground">用抽奖券抽限定名片和 2024 全球冠军赛音效</p></div>
            <Button size="sm" variant="hero">去抽奖</Button>
          </CardContent>
        </Card>
        {isLoading ? <p className="text-muted-foreground">加载中...</p> : items.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">背包空空的。开通优先账户后每周可领奖励。</CardContent></Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((it) => {
              const Icon = ICONS[it.item_type] || BackpackIcon;
              return (
                <Card key={it.id} className={it.status !== "unused" ? "opacity-60" : ""}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <Icon className="w-8 h-8 text-yellow-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{it.label}</p>
                      <p className="text-xs text-muted-foreground">{new Date(it.created_at).toLocaleDateString()} · 每周奖励</p>
                    </div>
                    {it.status === "unused" ? (
                      <Button size="sm" variant="hero" disabled={busy === it.id} onClick={() => use(it)}>
                        {it.item_type === "water_coupon" ? "使用" : it.item_type === "lottery_ticket" ? "抽奖" : "兑换"}
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">{STATUS[it.status]}</span>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
