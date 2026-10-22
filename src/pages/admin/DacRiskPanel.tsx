import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

type Risk = { profile_id: string; username: string; score: number; flags: number; high_flags: number; server_flags: number; top_reason: string };
type Twin = { player_a: string; name_a: string; player_b: string; name_b: string; shared_buckets: number; mean_ms: number };

/** 服务器行为分析：30天风险评分 + 跨账号节奏相似（仅供人工复核，不自动处罚） */
export default function DacRiskPanel() {
  const [risk, setRisk] = useState<Risk[]>([]);
  const [twins, setTwins] = useState<Twin[]>([]);
  useEffect(() => {
    supabase.rpc("admin_dac_risk" as any, { p_days: 30 }).then(({ data }) => setRisk(((data as Risk[]) ?? []).slice(0, 10)));
    supabase.rpc("admin_dac_timing_twins" as any, { p_days: 7 }).then(({ data }) => setTwins((data as Twin[]) ?? []));
  }, []);
  return (
    <div className="grid gap-3 md:grid-cols-2 my-3">
      <div className="border border-border p-3 space-y-1">
        <p className="font-semibold text-sm">风险评分榜（30天）</p>
        <p className="text-xs text-muted-foreground">高危5分/中2分/低1分，服务器证据×2</p>
        {risk.length === 0 && <p className="text-xs text-muted-foreground">暂无</p>}
        {risk.map((r) => (
          <div key={r.profile_id} className="flex items-center justify-between text-sm">
            <span>{r.username}</span>
            <span className="flex gap-1 items-center">
              <Badge variant={r.score >= 20 ? "destructive" : "outline"}>{r.score}分</Badge>
              <span className="text-xs text-muted-foreground">{r.flags}条/服务器{r.server_flags}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="border border-border p-3 space-y-1">
        <p className="font-semibold text-sm">疑似同一脚本（7天节奏相似）</p>
        <p className="text-xs text-muted-foreground">两个账号多局答题间隔几乎一致且极稳定</p>
        {twins.length === 0 && <p className="text-xs text-muted-foreground">暂无</p>}
        {twins.map((t) => (
          <div key={t.player_a + t.player_b} className="text-sm">
            {t.name_a} ↔ {t.name_b} <span className="text-xs text-muted-foreground">相同节奏{t.shared_buckets}次·约{(t.mean_ms / 1000).toFixed(1)}秒/题</span>
          </div>
        ))}
      </div>
    </div>
  );
}
