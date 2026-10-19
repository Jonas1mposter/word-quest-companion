import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/** 获胜方结算页：对手因 DAC 检测到脚本/异常程序被踢出时显示 */
export function DacCheaterNotice({ matchId, isWinner }: { matchId?: string; isWinner: boolean }) {
  const [cheated, setCheated] = useState(false);
  useEffect(() => {
    if (!matchId || !isWinner) return;
    let alive = true;
    (async () => {
      for (let i = 0; i < 3 && alive; i++) {
        const { data } = await supabase.functions.invoke("process-match", { body: { matchId, checkCheat: true } });
        if (data?.opponentCheated) { if (alive) setCheated(true); return; }
        await new Promise((r) => setTimeout(r, 1500));
      }
    })();
    return () => { alive = false; };
  }, [matchId, isWinner]);
  if (!cheated) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-3 mb-4 px-4 py-3 rounded-lg border border-destructive/40 bg-destructive/10">
      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-destructive text-destructive-foreground font-gaming text-sm">
        <ShieldAlert className="w-4 h-4" /> DAC
      </div>
      <span className="font-gaming text-destructive">检测到作弊者</span>
    </div>
  );
}
