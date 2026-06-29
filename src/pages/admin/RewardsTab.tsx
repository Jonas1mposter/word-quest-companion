import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, RefreshCw } from "lucide-react";

export const RewardsTab = () => {
  const [awardingCards, setAwardingCards] = useState(false);

  const awardCards = async () => {
    setAwardingCards(true);
    try {
      const { data, error } = await supabase.functions.invoke("award-leaderboard-cards");
      if (error) throw error;
      toast.success(data.message || "名片发放成功");
    } catch { toast.error("发放失败"); }
    finally { setAwardingCards(false); }
  };

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Award className="w-5 h-5 text-accent" />排行榜名片发放</CardTitle>
        <CardDescription>自动给各排行榜前10名发放专属名片</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white">
            <CardContent className="p-4">
              <div className="font-gaming text-lg">狄邦不败之巅</div>
              <div className="text-sm opacity-80">段位排行榜前10名</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-purple-600 via-pink-500 to-purple-600 text-white">
            <CardContent className="p-4">
              <div className="font-gaming text-lg">狄邦排位大师</div>
              <div className="text-sm opacity-80">排位胜利排行榜前10名</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white">
            <CardContent className="p-4">
              <div className="font-gaming text-lg">狄邦至高巅峰</div>
              <div className="text-sm opacity-80">经验值排行榜前10名</div>
            </CardContent>
          </Card>
        </div>
        <Button onClick={awardCards} disabled={awardingCards} className="w-full" size="lg">
          <RefreshCw className={`w-4 h-4 mr-2 ${awardingCards ? "animate-spin" : ""}`} />
          {awardingCards ? "发放中..." : "立即发放排行榜名片"}
        </Button>
        <p className="text-sm text-muted-foreground text-center">
          点击后将自动给7年级和8年级各排行榜前10名发放对应名片
        </p>
      </CardContent>
    </Card>
  );
};
