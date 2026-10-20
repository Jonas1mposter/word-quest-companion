import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, Flame, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// 连签第 1-7 天的豆子奖励，第 7 天起每天 200（周末北京时间双倍）
const SCHEDULE = [40, 50, 60, 70, 80, 100, 200];

const isBeijingWeekend = () => {
  const bj = new Date(Date.now() + 8 * 3600_000);
  const dow = bj.getUTCDay();
  return dow === 0 || dow === 6;
};

const CheckInCard = () => {
  const { profile } = useAuth();
  const [streak, setStreak] = useState<number | null>(null);
  const [todayCoins, setTodayCoins] = useState<number | null>(null);
  const weekend = isBeijingWeekend();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.rpc("record_daily_login" as any);
        if (cancelled || !data?.ok) return;
        setStreak(data.streak ?? null);
        if (!data.already && (data.coins ?? 0) > 0) {
          setTodayCoins(data.coins ?? 0);
          toast.success(`📅 签到成功 +${data.coins} 狄邦豆${weekend ? "（周末双倍）" : ""}`);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [profile?.id]);

  const effStreak = streak ?? profile?.streak ?? 0;
  const dayIdx = Math.min(Math.max(effStreak, 1), 7);
  const base = SCHEDULE[dayIdx - 1];
  const todayVal = weekend ? base * 2 : base;

  return (
    <div className="border border-border/60 bg-card val-cut-sm p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <CalendarCheck className="h-3.5 w-3.5 text-primary" /> 每日签到
        </span>
        <span className="flex items-center gap-1 font-tactical text-xs text-primary">
          <Flame className="h-3.5 w-3.5" /> 连签 {effStreak} 天
        </span>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {SCHEDULE.map((amount, i) => {
          const dayNo = i + 1;
          const done = dayNo < dayIdx;
          const isToday = dayNo === dayIdx;
          return (
            <div
              key={dayNo}
              className={cn(
                "rounded-sm border px-0.5 py-1.5 text-center",
                done && "border-primary/40 bg-primary/10",
                isToday && "border-primary bg-primary/20",
                !done && !isToday && "border-border/40 opacity-60",
              )}
            >
              <div className={cn("text-[9px] leading-tight", isToday ? "font-bold text-primary" : "text-muted-foreground")}>
                {dayNo === 7 ? "7天+" : `第${dayNo}天`}
              </div>
              <div className={cn("font-tactical text-[11px] leading-tight", isToday ? "font-bold text-primary" : done ? "text-primary" : "text-muted-foreground")}>
                {amount}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {weekend ? "周末双倍豆进行中" : "登录即自动签到，周末双倍"}
        </span>
        <Badge variant="gold" className="gap-1 text-xs">
          <Coins className="h-3 w-3" />
          {todayCoins !== null ? `今日 +${todayCoins}` : `今日 +${todayVal}`}
        </Badge>
      </div>
    </div>
  );
};

export default CheckInCard;
