import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Search, User } from "lucide-react";
import { UserProfile } from "./types";

interface Props {
  users: UserProfile[];
  refresh: () => void;
}

export const CoinsTab = ({ users, refresh }: Props) => {
  const [coinSearchTerm, setCoinSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [coinAmount, setCoinAmount] = useState("");
  const [distributingCoins, setDistributingCoins] = useState(false);

  const filtered = users.filter((u) => u.username.toLowerCase().includes(coinSearchTerm.toLowerCase()));

  const distributeCoins = async () => {
    if (!selectedUser || !coinAmount || parseInt(coinAmount) <= 0) {
      toast.error("请选择用户并输入有效金额");
      return;
    }
    setDistributingCoins(true);
    try {
      const amount = parseInt(coinAmount);
      const { data: cur, error: fe } = await supabase.from("profiles")
        .select("coins").eq("id", selectedUser.id).single();
      if (fe) throw fe;
      const newCoins = (cur?.coins || 0) + amount;
      const { error } = await supabase.from("profiles")
        .update({ coins: newCoins }).eq("id", selectedUser.id);
      if (error) throw error;
      toast.success(`成功发放 ${amount} 狄邦豆给 ${selectedUser.username}，当前余额: ${newCoins}`);
      setCoinAmount(""); setSelectedUser(null); setCoinSearchTerm("");
      refresh();
    } catch { toast.error("发放失败"); }
    finally { setDistributingCoins(false); }
  };

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Coins className="w-5 h-5 text-accent" />发放狄邦豆</CardTitle>
        <CardDescription>给指定用户发放狄邦豆奖励</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">搜索用户</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="输入用户名搜索..." value={coinSearchTerm}
              onChange={(e) => { setCoinSearchTerm(e.target.value); setSelectedUser(null); }}
              className="pl-10" />
          </div>
        </div>

        {coinSearchTerm && !selectedUser && (
          <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">未找到匹配用户</p>
            ) : filtered.slice(0, 10).map((u) => (
              <button key={u.id}
                onClick={() => { setSelectedUser(u); setCoinSearchTerm(u.username); }}
                className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-secondary transition-colors text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{u.username}</div>
                    <div className="text-xs text-muted-foreground">Lv.{u.level} · {u.grade}年级</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-accent">
                  <Coins className="w-4 h-4" />
                  <span className="font-gaming">{u.coins}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <div className="font-gaming text-lg">{selectedUser.username}</div>
                  <div className="text-sm text-muted-foreground">Lv.{selectedUser.level} · {selectedUser.grade}年级</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">当前余额</div>
                <div className="flex items-center gap-1 text-accent font-gaming text-xl">
                  <Coins className="w-5 h-5" />{selectedUser.coins}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedUser && (
          <>
            <div className="space-y-2">
              <label className="text-sm text-muted-foreground">发放数量</label>
              <Input type="number" min="1" placeholder="输入要发放的狄邦豆数量..."
                value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)}
                className="text-center text-xl font-gaming" />
            </div>
            <div className="flex flex-wrap gap-2">
              {[10, 50, 100, 200, 500, 1000].map((a) => (
                <Button key={a} variant="outline" size="sm" onClick={() => setCoinAmount(a.toString())}>+{a}</Button>
              ))}
            </div>
          </>
        )}

        <Button onClick={distributeCoins}
          disabled={!selectedUser || !coinAmount || parseInt(coinAmount) <= 0 || distributingCoins}
          className="w-full" size="lg">
          <Coins className={`w-4 h-4 mr-2 ${distributingCoins ? "animate-spin" : ""}`} />
          {distributingCoins ? "发放中..." : `发放 ${coinAmount || 0} 狄邦豆`}
        </Button>

        {selectedUser && coinAmount && parseInt(coinAmount) > 0 && (
          <p className="text-sm text-muted-foreground text-center">
            发放后 {selectedUser.username} 将拥有 {selectedUser.coins + parseInt(coinAmount)} 狄邦豆
          </p>
        )}
      </CardContent>
    </Card>
  );
};
