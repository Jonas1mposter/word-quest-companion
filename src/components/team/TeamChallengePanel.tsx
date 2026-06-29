import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, Trophy, Crown, Medal, Coins, Loader2, Sparkles, Settings, Plus, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Season {
  id: string;
  name: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  reward_tiers: number[];
  finalized_at: string | null;
}

interface ScoreRow {
  team_id: string;
  points: number;
  team_name: string;
  avatar_url: string | null;
  member_count: number;
}

const DEFAULT_TIERS = [2000, 1000, 500, 400, 300, 250, 200, 150, 100, 100];

const tierColor = (i: number) =>
  i === 0
    ? "from-yellow-500/40 to-amber-500/10 border-yellow-500/60"
    : i === 1
    ? "from-slate-300/40 to-slate-100/10 border-slate-300/60"
    : i === 2
    ? "from-orange-500/40 to-orange-300/10 border-orange-500/60"
    : "from-muted/40 to-transparent border-border";

const formatRemaining = (endsAt: string) => {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return "已结束";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d} 天 ${h} 小时`;
  if (h > 0) return `${h} 小时 ${m} 分钟`;
  return `${m} 分钟`;
};

export const TeamChallengePanel = ({ onBack }: { onBack: () => void }) => {
  const { profile } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [active, setActive] = useState<Season | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [myTeamId, setMyTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    reward_tiers: DEFAULT_TIERS.join(","),
  });
  const [finalizing, setFinalizing] = useState<string | null>(null);

  useEffect(() => {
    void loadAll();
  }, [profile?.id]);

  const loadAll = async () => {
    if (!profile) return;
    setLoading(true);

    // admin check
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.user_id)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!roleData);

    // my team
    const { data: myMember } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("profile_id", profile.id)
      .maybeSingle();
    setMyTeamId(myMember?.team_id ?? null);

    // seasons
    const { data: ss } = await supabase
      .from("team_challenge_seasons")
      .select("*")
      .order("starts_at", { ascending: false });
    const list = (ss ?? []) as Season[];
    setSeasons(list);

    const current =
      list.find((s) => s.status === "active" && new Date(s.starts_at) <= new Date() && new Date(s.ends_at) > new Date()) ??
      list.find((s) => s.status === "active") ??
      null;
    setActive(current);

    if (current) await loadScores(current.id);
    else setScores([]);

    setLoading(false);
  };

  const loadScores = async (seasonId: string) => {
    const { data: rows } = await supabase
      .from("team_challenge_scores")
      .select("team_id, points")
      .eq("season_id", seasonId)
      .order("points", { ascending: false })
      .limit(50);

    const ids = (rows ?? []).map((r) => r.team_id);
    if (ids.length === 0) {
      setScores([]);
      return;
    }
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name, avatar_url")
      .in("id", ids);
    const { data: mc } = await supabase
      .from("team_members")
      .select("team_id")
      .in("team_id", ids);
    const countMap = new Map<string, number>();
    for (const m of mc ?? []) countMap.set(m.team_id, (countMap.get(m.team_id) ?? 0) + 1);
    const teamMap = new Map((teams ?? []).map((t) => [t.id, t]));

    setScores(
      (rows ?? []).map((r) => {
        const t = teamMap.get(r.team_id);
        return {
          team_id: r.team_id,
          points: r.points,
          team_name: t?.name ?? "未知战队",
          avatar_url: t?.avatar_url ?? null,
          member_count: countMap.get(r.team_id) ?? 0,
        };
      }),
    );
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error("请输入赛季名称");
      return;
    }
    const tiers = form.reward_tiers
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (tiers.length === 0) {
      toast.error("奖励档位无效");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("team_challenge_seasons").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: new Date(form.ends_at).toISOString(),
      reward_tiers: tiers,
      status: "active",
    });
    setCreating(false);
    if (error) {
      toast.error("创建失败：" + error.message);
      return;
    }
    toast.success("赛季已开启");
    setShowCreate(false);
    await loadAll();
  };

  const handleFinalize = async (seasonId: string) => {
    if (!confirm("结算后将立即发放奖励且不可撤销，确认结算？")) return;
    setFinalizing(seasonId);
    const { data, error } = await supabase.functions.invoke("finalize-team-challenge", {
      body: { seasonId },
    });
    setFinalizing(null);
    if (error || (data as any)?.error) {
      toast.error("结算失败：" + (error?.message ?? (data as any)?.error));
      return;
    }
    toast.success(`结算完成，共发放 ${(data as any)?.totalRewards ?? 0} 份奖励`);
    await loadAll();
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            返回
          </Button>
          {isAdmin && (
            <Button onClick={() => setShowCreate(true)} variant="default">
              <Plus className="h-4 w-4 mr-1" />
              开启新赛季
            </Button>
          )}
        </div>

        <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Trophy className="h-6 w-6 text-yellow-500" />
              战队挑战赛
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              排位赛每胜一场为所在战队 +1 分。赛季结束后，战队积分前列将瓜分高额狄邦豆！
            </p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !active ? (
              <div className="text-center py-8 space-y-2">
                <Sparkles className="h-10 w-10 mx-auto text-muted-foreground" />
                <p className="text-muted-foreground">当前没有进行中的挑战赛</p>
                {isAdmin && <p className="text-xs text-muted-foreground">点击右上角"开启新赛季"创建</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <p className="text-xs text-muted-foreground">当前赛季</p>
                    <p className="font-bold text-lg">{active.name}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <p className="text-xs text-muted-foreground">剩余时间</p>
                    <p className="font-bold text-lg text-primary">{formatRemaining(active.ends_at)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/30 border">
                    <p className="text-xs text-muted-foreground">奖励档位</p>
                    <p className="font-bold text-lg flex items-center gap-1">
                      <Coins className="h-4 w-4 text-yellow-500" />
                      最高 {active.reward_tiers[0] ?? 0}
                    </p>
                  </div>
                </div>

                {active.description && (
                  <p className="text-sm text-muted-foreground italic">{active.description}</p>
                )}

                {isAdmin && (
                  <div className="flex justify-end">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={finalizing === active.id}
                      onClick={() => handleFinalize(active.id)}
                    >
                      {finalizing === active.id ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Flag className="h-4 w-4 mr-1" />
                      )}
                      立即结算并发放奖励
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {active && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Medal className="h-5 w-5 text-primary" />
                战队积分榜
              </CardTitle>
            </CardHeader>
            <CardContent>
              {scores.length === 0 ? (
                <p className="text-center text-muted-foreground py-6">还没有战队上分，快去排位赛拿首胜！</p>
              ) : (
                <div className="space-y-2">
                  {scores.map((s, i) => {
                    const reward = active.reward_tiers[i];
                    const isMine = s.team_id === myTeamId;
                    return (
                      <div
                        key={s.team_id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border bg-gradient-to-r",
                          tierColor(i),
                          isMine && "ring-2 ring-primary",
                        )}
                      >
                        <div className="w-10 text-center font-bold text-lg">
                          {i === 0 ? <Crown className="h-6 w-6 mx-auto text-yellow-500" /> : `#${i + 1}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate flex items-center gap-2">
                            {s.team_name}
                            {isMine && <Badge variant="secondary" className="text-[10px]">我的战队</Badge>}
                          </p>
                          <p className="text-xs text-muted-foreground">{s.member_count} 名成员</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-primary">{s.points} 分</p>
                          {reward ? (
                            <p className="text-xs text-yellow-600 flex items-center gap-1 justify-end">
                              <Coins className="h-3 w-3" />
                              每人 {reward}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">无奖励</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {seasons.some((s) => s.status === "ended") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                历史赛季
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {seasons
                .filter((s) => s.status === "ended")
                .slice(0, 5)
                .map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm border-b py-2 last:border-0">
                    <span>{s.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {s.finalized_at ? new Date(s.finalized_at).toLocaleDateString() : "—"} 已结算
                    </span>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>开启战队挑战赛</DialogTitle>
            <DialogDescription>设置赛季名称、起止时间和奖励档位（逗号分隔，依次对应第 1、2、3...名）</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>赛季名称</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：暑期战队争霸赛" />
            </div>
            <div>
              <Label>描述（可选）</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>开始时间</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <Label>结束时间</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>奖励档位（每人狄邦豆）</Label>
              <Input value={form.reward_tiers} onChange={(e) => setForm({ ...form, reward_tiers: e.target.value })} />
              <p className="text-xs text-muted-foreground mt-1">默认：{DEFAULT_TIERS.join(", ")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              开启赛季
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
