import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Gift, Ticket, Trophy, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import reaver6 from "@/assets/kill-sounds/reaver/reaver_6.png.asset.json";
import reaverAudio from "@/assets/kill-sounds/reaver/reaver_1.mp3.asset.json";

interface ReaverStatus { completed?: boolean; claimed?: boolean; active?: boolean; error?: string }

export default function EventCenter() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const qc = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["reaver-event", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("reaver_event_status" as any);
      if (error) throw error;
      return data as ReaverStatus;
    },
  });

  const claim = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("claim_reaver_event" as any);
      if (error) throw error;
      return data as { ok: boolean; error?: string };
    },
    onSuccess: (res) => {
      if (res.ok) toast.success("领取成功：掠影音效 + 10 张抽奖券");
      else toast.error(res.error ?? "领取失败");
      qc.invalidateQueries({ queryKey: ["reaver-event"] });
    },
    onError: () => toast.error("网络异常，请稍后重试"),
  });

  const steps = [
    { label: "登录账号", done: !!profile },
    { label: "完成一场真人排位赛", done: !!status?.completed },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" />主页</Button>
          <span className="text-xs font-semibold text-primary">EVENT CENTER</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
        <h1 className="font-gaming text-4xl">活动中心</h1>
        <article className="grid gap-6 border border-border bg-card p-6 sm:grid-cols-[220px_1fr] sm:p-8">
          <div className="flex flex-col items-center gap-3">
            <img src={reaver6.url} alt="掠影" className="h-48 w-48 object-contain" />
            <Button variant="outline" size="sm" onClick={() => new Audio(reaverAudio.url).play().catch(() => {})}>
              <Volume2 className="mr-2 h-4 w-4" />试听
            </Button>
          </div>
          <div className="space-y-4">
            <span className="border border-primary/50 px-3 py-1 text-xs font-semibold text-primary">限时 · 10月22日 – 11月22日</span>
            <h2 className="font-gaming text-3xl">掠影首发 · 免费领</h2>
            <p className="text-sm text-muted-foreground">完成任务即可免费获得限定连杀音效「掠影」与 10 张抽奖券（所有奖池通用）。人机补位局不计入。</p>
            <ul className="space-y-2">
              {steps.map(s => (
                <li key={s.label} className="flex items-center gap-2 text-sm">
                  <span className={`flex h-5 w-5 items-center justify-center border ${s.done ? "border-success bg-success/20 text-success" : "border-border"}`}>{s.done && <Check className="h-3 w-3" />}</span>
                  {s.label}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-2"><Trophy className="h-4 w-4 text-gold" />限定音效「掠影」</span>
              <span className="flex items-center gap-2"><Ticket className="h-4 w-4 text-primary" />抽奖券 ×10</span>
            </div>
            {!profile ? (
              <Button variant="hero" onClick={() => navigate("/auth")}>登录参与</Button>
            ) : status?.claimed ? (
              <Button disabled><Check className="mr-2 h-4 w-4" />已领取</Button>
            ) : status?.completed ? (
              <Button variant="hero" disabled={claim.isPending || !status.active} onClick={() => claim.mutate()}>
                <Gift className="mr-2 h-4 w-4" />{claim.isPending ? "领取中…" : "立即领取"}
              </Button>
            ) : (
              <Button variant="outline" disabled={isLoading} onClick={() => navigate("/")}>去打排位</Button>
            )}
          </div>
        </article>
      </main>
    </div>
  );
}
