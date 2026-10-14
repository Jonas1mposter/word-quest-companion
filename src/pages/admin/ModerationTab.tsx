import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Ban, CupSoda, Search, Ticket, Unlock } from "lucide-react";
import { UserProfile } from "./types";
import { banCaseId } from "@/components/BanScreen";

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: "1小时", hours: 1 }, { label: "8小时", hours: 8 }, { label: "1天", hours: 24 },
  { label: "3天", hours: 72 }, { label: "7天", hours: 168 }, { label: "365天", hours: 8760 },
  { label: "3650天", hours: 87600 }, { label: "永久", hours: null },
];

export const ModerationTab = ({ users }: { users: UserProfile[] }) => {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<UserProfile | null>(null);
  const [reason, setReason] = useState("");
  const [count, setCount] = useState("1");
  const [ticketCount, setTicketCount] = useState("1");
  const [busy, setBusy] = useState(false);
  const [banInfo, setBanInfo] = useState<{ banned_until: string | null; ban_reason: string | null } | null>(null);

  const loadBan = async (id: string) => {
    const { data } = await supabase.from("profiles").select("banned_until, ban_reason" as any).eq("id", id).single();
    setBanInfo(data as any);
  };
  useEffect(() => { if (sel) loadBan(sel.id); else setBanInfo(null); }, [sel]);

  const filtered = users.filter((u) => u.username.toLowerCase().includes(q.toLowerCase())).slice(0, 10);
  const bannedActive = banInfo?.banned_until && new Date(banInfo.banned_until) > new Date();

  const grantCoupon = async () => {
    if (!sel) return;
    setBusy(true);
    const { error } = await supabase.rpc("admin_grant_water_coupon" as any, { p_profile_id: sel.id, p_count: parseInt(count) || 1 });
    setBusy(false);
    if (error) return toast.error("发放失败：" + error.message);
    toast.success(`已发放 ${count} 张水吧券给 ${sel.username}，已放入背包`);
  };

  const grantTicket = async () => {
    if (!sel) return;
    const n = parseInt(ticketCount) || 1;
    setBusy(true);
    const { error } = await supabase.rpc("admin_grant_lottery_ticket" as any, { p_profile_id: sel.id, p_count: n });
    setBusy(false);
    if (error) return toast.error("发放失败：" + error.message);
    toast.success(`已发放 ${n} 张抽奖券给 ${sel.username}，已放入背包`);
  };

  const ban = async (hours: number | null, label: string) => {
    if (!sel) return;
    if (hours !== 0 && !confirm(`确定${label === "永久" ? "永久封禁" : `封禁 ${label}`} ${sel.username}？`)) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-ban", { body: { profile_id: sel.id, hours, reason } });
    setBusy(false);
    if (error || (data as any)?.error) return toast.error("操作失败：" + ((data as any)?.error || error?.message));
    toast.success(hours === 0 ? `已解封 ${sel.username}` : `已封禁 ${sel.username}（${label}）`);
    loadBan(sel.id);
  };

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Ban className="w-5 h-5 text-destructive" />封禁与水吧券</CardTitle>
        <CardDescription>选择玩家后可发放水吧券，或限时 / 永久封禁账号</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-10" placeholder="输入用户名搜索..." value={q} onChange={(e) => { setQ(e.target.value); setSel(null); }} />
        </div>
        {q && !sel && (
          <div className="max-h-48 overflow-y-auto border border-border p-1 space-y-1">
            {filtered.length === 0 ? <p className="text-sm text-muted-foreground text-center py-3">未找到</p> :
              filtered.map((u) => (
                <button key={u.id} className="w-full text-left p-2 hover:bg-secondary" onClick={() => { setSel(u); setQ(u.username); }}>
                  {u.username} <span className="text-xs text-muted-foreground">Lv.{u.level} · {u.grade}年级</span>
                </button>
              ))}
          </div>
        )}

        {sel && (
          <>
            <div className="p-3 border border-border bg-secondary/40 text-sm">
              <b>{sel.username}</b>：
              {bannedActive ? (
                <span className="text-destructive"> 封禁中，至 {new Date(banInfo!.banned_until!).getFullYear() > 2100 ? "永久" : new Date(banInfo!.banned_until!).toLocaleString()}
                  {banInfo?.ban_reason ? `（${banInfo.ban_reason}）` : ""} · 编号 {banCaseId(sel?.id ?? "", banInfo!.banned_until!)}</span>
              ) : <span className="text-success"> 正常</span>}
            </div>

            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2"><CupSoda className="w-4 h-4 text-yellow-400" />发放水吧券</h3>
              <div className="flex gap-2">
                <Input type="number" min="1" max="100" value={count} onChange={(e) => setCount(e.target.value)} className="w-24" />
                <Button variant="gold" disabled={busy} onClick={grantCoupon}>发放到背包</Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2"><Ticket className="w-4 h-4 text-primary" />发放抽奖券</h3>
              <div className="flex gap-2">
                <Input type="number" min="1" max="100" value={ticketCount} onChange={(e) => setTicketCount(e.target.value)} className="w-24" />
                <Button variant="gold" disabled={busy} onClick={grantTicket}>发放到背包</Button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-medium flex items-center gap-2"><Ban className="w-4 h-4 text-destructive" />封禁账号</h3>
              <Input placeholder="封禁原因（选填）" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((d) => (
                  <Button key={d.label} size="sm" variant="destructive" disabled={busy} onClick={() => ban(d.hours, d.label)}>{d.label}</Button>
                ))}
                {bannedActive && (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => ban(0, "解封")}><Unlock className="w-4 h-4 mr-1" />解封</Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">封禁后对方无法登录；已在线的会在下次刷新时被踢出。</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
