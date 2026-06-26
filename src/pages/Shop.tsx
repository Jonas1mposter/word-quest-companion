import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, Coins, Sparkles, Gift, Loader2, ShoppingBag, Volume2, Check, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { reloadActiveSoundPack } from "@/hooks/useMatchSounds";

type DrawCard = {
  id?: string;
  name?: string;
  rarity?: string;
  icon?: string;
  background_gradient?: string;
  description?: string;
  refunded?: boolean;
};

const RARITY_STYLE: Record<string, string> = {
  common: "from-slate-500 to-slate-700 text-white border-slate-400",
  rare: "from-blue-500 to-cyan-500 text-white border-blue-400",
  epic: "from-purple-500 to-pink-500 text-white border-purple-400",
  legendary: "from-amber-500 to-yellow-400 text-background border-amber-400",
};

const RARITY_LABEL: Record<string, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
};

const SINGLE_COST = 100;
const TEN_COST = 900;

export default function Shop() {
  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const [drawing, setDrawing] = useState<null | 1 | 10>(null);
  const [results, setResults] = useState<DrawCard[] | null>(null);
  const [poolPreview, setPoolPreview] = useState<{ rarity: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("name_cards")
        .select("rarity")
        .eq("in_gacha_pool", true);
      if (!data) return;
      const map: Record<string, number> = {};
      for (const r of data) map[r.rarity] = (map[r.rarity] || 0) + 1;
      setPoolPreview(
        ["common", "rare", "epic", "legendary"]
          .filter((r) => map[r])
          .map((rarity) => ({ rarity, count: map[rarity] })),
      );
    })();
  }, []);

  const draw = async (count: 1 | 10) => {
    if (!profile) return;
    const cost = count === 10 ? TEN_COST : SINGLE_COST;
    if ((profile.coins ?? 0) < cost) {
      toast.error(`狄邦豆不足，需要 ${cost}`);
      return;
    }
    setDrawing(count);
    try {
      const { data, error } = await supabase.rpc("gacha_draw", { p_count: count });
      if (error) throw error;
      const payload = data as any;
      if (payload?.error) {
        toast.error(payload.error === "not_enough_coins" ? "狄邦豆不足" : String(payload.error));
        return;
      }
      setResults((payload?.results as DrawCard[]) ?? []);
      if (payload?.refund > 0) {
        toast.info(`奖池有 ${(payload.refund / 50)} 张已满，返还 ${payload.refund} 狄邦豆`);
      }
      await refreshProfile();
    } catch (e: any) {
      toast.error(e?.message || "抽卡失败，请稍后再试");
    } finally {
      setDrawing(null);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ChevronLeft className="w-4 h-4 mr-1" />返回
          </Button>
          <div className="flex items-center gap-2 text-base font-gaming">
            <Coins className="w-5 h-5 text-yellow-400" />
            <span className="text-yellow-400">{profile?.coins ?? 0}</span>
            <span className="text-muted-foreground text-sm">狄邦豆</span>
          </div>
        </header>

        <Card className="overflow-hidden border-amber-400/40 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent">
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-7 h-7 text-amber-400" />
              <div>
                <h1 className="text-2xl font-gaming">狄邦商城 · 名片扭蛋</h1>
                <p className="text-sm text-muted-foreground">
                  消耗狄邦豆抽取专属名片，稀有度越高越闪耀。
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <RateRow label="普通 Common" pct="45%" color="bg-slate-500" />
              <RateRow label="稀有 Rare" pct="35%" color="bg-blue-500" />
              <RateRow label="史诗 Epic" pct="15%" color="bg-purple-500" />
              <RateRow label="传说 Legendary" pct="5%" color="bg-amber-400" />
            </div>
            {poolPreview.length > 0 && (
              <p className="text-xs text-muted-foreground">
                当前奖池：
                {poolPreview.map((p) => `${RARITY_LABEL[p.rarity] ?? p.rarity}×${p.count}`).join(" / ")}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="border-primary/30 hover:border-primary/60 transition-colors">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <Sparkles className="w-10 h-10 text-primary" />
              <h3 className="text-lg font-gaming">单次召唤</h3>
              <p className="text-sm text-muted-foreground">单抽一张名片</p>
              <Button
                size="lg"
                className="w-full"
                disabled={drawing !== null || (profile?.coins ?? 0) < SINGLE_COST}
                onClick={() => draw(1)}
              >
                {drawing === 1 ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Coins className="w-4 h-4 mr-2" />
                )}
                {SINGLE_COST} 狄邦豆
              </Button>
            </CardContent>
          </Card>

          <Card className="border-amber-400/40 hover:border-amber-400/70 transition-colors bg-amber-500/5">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <Gift className="w-10 h-10 text-amber-400" />
              <h3 className="text-lg font-gaming">十连召唤</h3>
              <p className="text-sm text-muted-foreground">一次性抽 10 张，节省 100 豆</p>
              <Button
                size="lg"
                variant="default"
                className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                disabled={drawing !== null || (profile?.coins ?? 0) < TEN_COST}
                onClick={() => draw(10)}
              >
                {drawing === 10 ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Coins className="w-4 h-4 mr-2" />
                )}
                {TEN_COST} 狄邦豆
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          重复名片不计入获得，奖池若该稀有度已抽满会自动降级或返还 50% 狄邦豆。
        </p>
      </div>

      <Dialog open={!!results} onOpenChange={(o) => !o && setResults(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />抽卡结果
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto py-2">
            {results?.map((c, i) => (
              <Card
                key={i}
                className={cn(
                  "overflow-hidden border-2",
                  c.refunded ? "border-dashed opacity-70" : "border-transparent",
                )}
              >
                <CardContent
                  className={cn(
                    "p-3 h-32 flex flex-col items-center justify-center text-center bg-gradient-to-br",
                    c.refunded
                      ? "from-muted/30 to-muted/10 text-muted-foreground"
                      : RARITY_STYLE[c.rarity || "common"],
                  )}
                >
                  {c.refunded ? (
                    <>
                      <Coins className="w-6 h-6 mb-1" />
                      <div className="text-xs">奖池已满</div>
                      <div className="text-[10px]">返还 50 豆</div>
                    </>
                  ) : (
                    <>
                      <div className="text-2xl mb-1">{c.icon || "🎴"}</div>
                      <div className="font-gaming text-sm truncate w-full">{c.name}</div>
                      <Badge variant="outline" className="mt-1 text-[10px] border-current">
                        {RARITY_LABEL[c.rarity || "common"]}
                      </Badge>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => setResults(null)}>知道了</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RateRow({ label, pct, color }: { label: string; pct: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md bg-card/50">
      <div className="flex items-center gap-1.5">
        <span className={cn("w-2 h-2 rounded-full", color)} />
        <span className="text-foreground/80">{label}</span>
      </div>
      <span className="font-mono text-foreground">{pct}</span>
    </div>
  );
}
