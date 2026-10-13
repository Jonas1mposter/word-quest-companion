import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Gift, Backpack, Loader2 } from "lucide-react";
import { toast } from "sonner";

const weekStart = () => {
  const d = new Date(Date.now() + 8 * 3600 * 1000); // Shanghai
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
};

export const PRIORITY_REWARDS = [
  { label: "随机狄邦豆 1-300", p: "80%" },
  { label: "抽奖券", p: "15%" },
  { label: "随机名牌", p: "4%" },
  { label: "随机连杀音效", p: "0.99%" },
  { label: "水吧券 ×1", p: "0.01%" },
];

const PriorityAccountCard = () => {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const p = profile as any;
  const isPriority = !!p?.is_priority;
  const claimed = !!p?.priority_last_claim && p.priority_last_claim >= weekStart();

  const buy = async () => {
    if (!confirm("花费 2000 狄邦豆开通优先账户（永久）？")) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("purchase_priority" as any);
    setBusy(false);
    const r = data as any;
    if (error || r?.error) {
      toast.error(r?.error === "not_enough_coins" ? "狄邦豆不足 2000" : r?.error === "already" ? "你已经是优先账户" : "开通失败，请重试");
      return;
    }
    toast.success("开通成功！已获得专属「优先铭牌」和「优先特权」勋章");
    refreshProfile();
  };

  const claim = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("claim_priority_weekly" as any);
    setBusy(false);
    const r = data as any;
    if (error || r?.error) {
      toast.error(r?.error === "claimed" ? "本周已领取，下周一再来" : "领取失败，请重试");
      return;
    }
    toast.success(`本周奖励：${r.label}！已放入背包`);
    refreshProfile();
  };

  return (
    <Card className="overflow-hidden border-yellow-500/50 bg-gradient-to-br from-yellow-500/15 via-amber-600/5 to-transparent">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Crown className="w-7 h-7 text-yellow-400" />
          <div className="flex-1">
            <h2 className="text-xl font-gaming">狄邦优先账户 {isPriority && <span className="text-yellow-400 text-sm">· 已开通</span>}</h2>
            <p className="text-sm text-muted-foreground">2000 狄邦豆永久开通，送专属「优先铭牌」+「优先特权」勋章，每周可领一次随机奖励。</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
          {PRIORITY_REWARDS.map((r) => (
            <div key={r.label} className="border border-yellow-500/20 bg-background/40 p-2 text-center">
              <div>{r.label}</div>
              <div className="text-yellow-400 font-bold">{r.p}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          {!isPriority ? (
            <Button variant="gold" className="flex-1" disabled={busy} onClick={buy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Crown className="w-4 h-4 mr-2" />}开通 · 2000 狄邦豆
            </Button>
          ) : (
            <Button variant="gold" className="flex-1" disabled={busy || claimed} onClick={claim}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
              {claimed ? "本周已领取" : "领取本周奖励"}
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate("/backpack")}>
            <Backpack className="w-4 h-4 mr-2" />背包
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PriorityAccountCard;
