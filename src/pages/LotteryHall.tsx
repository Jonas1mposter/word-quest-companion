import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, Backpack, Ticket, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { lotteryEvents } from "@/lib/lottery-events";

export default function LotteryHall() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { data: ticketCount, isLoading, isError } = useQuery({
    queryKey: ["lottery-ticket-count", profile?.id],
    enabled: !!profile,
    queryFn: async () => {
      if (!profile) return 0;
      const { count, error } = await supabase.from("backpack_items" as any)
        .select("id", { count: "exact", head: true })
        .eq("profile_id", profile.id).eq("item_type", "lottery_ticket").eq("status", "unused");
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}><ArrowLeft className="mr-2 h-4 w-4" />主页</Button>
          <div className="flex items-center gap-3">
            {profile ? <span className="flex items-center gap-2 text-sm"><Ticket className="h-4 w-4 text-primary" /><span className="font-mono">{isLoading ? "…" : isError ? "—" : ticketCount ?? 0}</span>张抽奖券</span> : <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>登录</Button>}
            <Button variant="outline" size="sm" onClick={() => navigate(profile ? "/backpack" : "/auth")}><Backpack className="mr-2 h-4 w-4" />背包</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="mb-3 text-xs font-semibold text-primary">WORD QUEST / EVENTS</p>
            <h1 className="font-gaming text-4xl sm:text-5xl">抽奖大厅</h1>
          </div>
          <span className="shrink-0 text-sm text-muted-foreground">{lotteryEvents.length} 个进行中活动</span>
        </div>

        <section aria-label="精选抽奖活动" className="space-y-4">
          {lotteryEvents.map(event => (
            <article key={event.id} className="relative isolate min-h-[460px] overflow-hidden border border-border bg-card sm:min-h-[440px]">
              <img src={event.image} alt={event.name} width={1536} height={864} className="absolute inset-0 -z-20 h-full w-full object-cover object-[65%_center] sm:object-center" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/95 via-background/70 to-background/10" />
              <div className="flex min-h-[460px] max-w-xl flex-col items-start justify-between p-6 sm:min-h-[440px] sm:p-10">
                <span className="border border-primary/50 bg-background/60 px-3 py-1 text-xs font-semibold text-primary">进行中 · 抽奖券限定</span>
                <div className="mt-16 space-y-4 sm:mt-8">
                  <p className="text-sm font-semibold text-gold">{event.subtitle}</p>
                  <h2 className="font-gaming text-3xl sm:text-4xl">{event.name}</h2>
                  <p className="text-sm text-muted-foreground">{event.description}</p>
                  <p className="flex items-center gap-2 text-sm"><Trophy className="h-4 w-4 shrink-0 text-gold" />{event.featuredPrize}</p>
                  <div className="flex flex-wrap items-center gap-4 pt-4">
                    <Button variant="hero" size="lg" onClick={() => navigate(event.path)}>进入活动<ArrowUpRight className="ml-2 h-4 w-4" /></Button>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground"><Ticket className="h-4 w-4" />{event.cost}</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="border-t border-border py-6" aria-label="全部活动">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-gaming text-xl">全部活动</h2><span className="text-xs text-muted-foreground">进行中</span></div>
          {lotteryEvents.map(event => (
            <div key={event.id} className="flex flex-wrap items-center gap-4 border-b border-border py-4">
              <img src={event.image} alt="" loading="lazy" width={96} height={64} className="h-16 w-24 shrink-0 object-cover" />
              <div className="min-w-0 flex-1"><h3 className="font-semibold">{event.name}</h3><p className="mt-1 text-xs text-muted-foreground">{event.cost}</p></div>
              <Button variant="outline" size="sm" onClick={() => navigate(event.path)}>查看奖池<ArrowUpRight className="ml-2 h-4 w-4" /></Button>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}