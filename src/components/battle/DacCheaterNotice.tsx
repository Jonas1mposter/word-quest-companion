import { useEffect, useState } from "react";
import dacLogo from "@/assets/dac-logo.png";
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
      <img src={dacLogo} alt="DAC" className="w-10 h-10 object-contain" />
      <span className="font-gaming text-destructive">检测到作弊者</span>
    </div>
  );
}
