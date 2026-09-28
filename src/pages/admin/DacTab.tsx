import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";

interface DacFlag {
  id: string;
  profile_id: string;
  source: string;
  reason: string;
  severity: string;
  meta: Record<string, any>;
  created_at: string;
  profiles?: { username: string } | null;
}

const REASON_LABELS: Record<string, string> = {
  impossible_answer_speed: "答题速度异常（对局）",
  impossible_level_speed: "过关速度异常（闯关）",
};

const SOURCE_LABELS: Record<string, string> = {
  "submit-answer": "对战答题",
  "complete-level": "闯关结算",
};

export function DacTab() {
  const [flags, setFlags] = useState<DacFlag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dac_flags")
      .select("*, profiles(username)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) console.error("DAC flags fetch failed", error);
    setFlags((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchFlags(); }, []);

  const severityVariant = (s: string) =>
    s === "high" ? "destructive" : s === "medium" ? "default" : "outline";

  return (
    <Card variant="gaming">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-destructive" />
            DAC 反作弊监控
            <Badge variant="outline">{flags.length} 条记录</Badge>
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={fetchFlags}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Dipont Anti-Cheat 自动检测答题/闯关速度异常。标记仅作记录，不影响玩家正常结算。
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : flags.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无可疑记录，一切正常 🛡️
          </div>
        ) : (
          <div className="space-y-2">
            {flags.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50"
              >
                <Badge variant={severityVariant(f.severity) as any} className="shrink-0">
                  {f.severity === "high" ? "高危" : f.severity === "medium" ? "可疑" : "提示"}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{f.profiles?.username ?? "未知玩家"}</span>
                    <span className="text-sm text-muted-foreground">
                      {REASON_LABELS[f.reason] ?? f.reason}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    来源：{SOURCE_LABELS[f.source] ?? f.source}
                    {typeof f.meta?.elapsedMs === "number" && ` · 用时 ${f.meta.elapsedMs}ms`}
                    {typeof f.meta?.perWordMs === "number" && ` · 每题 ${f.meta.perWordMs}ms`}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(f.created_at), { addSuffix: true, locale: zhCN })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
