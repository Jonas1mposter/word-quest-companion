import { useEffect, useRef, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

/**
 * DAC（Dipont Anti-Cheat）对局内常驻角标，固定在右下角。
 * status: 准备阶段「启动中」，答题阶段「监控中」。
 * 「监控中」时启用切屏检测：离开页面会被记录到 DAC 并弹出警告。
 */
const DacBadge = ({ status = "监控中" }: { status?: "启动中" | "监控中" }) => {
  const monitoring = status === "监控中";
  const [count, setCount] = useState(0);
  const [warn, setWarn] = useState(false);
  const countRef = useRef(0);
  const awayRef = useRef(false);

  useEffect(() => {
    if (!monitoring) return;
    const leave = () => {
      if (awayRef.current) return;
      awayRef.current = true;
      countRef.current += 1;
      setCount(countRef.current);
      supabase.rpc("report_tab_switch" as any, { p_count: countRef.current, p_mode: location.hash.slice(0, 40) }).then(() => {});
    };
    const back = () => {
      if (!awayRef.current) return;
      awayRef.current = false;
      setWarn(true);
    };
    const onVis = () => (document.hidden ? leave() : back());
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
    };
  }, [monitoring]);

  return (
    <>
      <div className="fixed bottom-3 right-3 z-50 pointer-events-none select-none">
        <div className="val-cut-sm flex items-center gap-1.5 px-2.5 py-1.5 bg-background/85 backdrop-blur border border-primary/50 shadow-[0_0_12px_hsl(var(--primary)/0.25)]">
          <ShieldCheck className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span className="font-tactical text-[10px] uppercase tracking-widest text-muted-foreground leading-none">
            Dipont Anti-Cheat <span className="text-primary">{status}</span>
          </span>
        </div>
      </div>
      {warn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur p-6">
          <div className="max-w-sm w-full border border-destructive/60 bg-card p-6 text-center space-y-3">
            <ShieldAlert className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="font-tactical text-xl uppercase tracking-widest text-destructive">DAC 检测到切屏</h2>
            <p className="text-sm text-muted-foreground">
              对局中禁止离开页面查答案。本局已切屏 <span className="text-destructive font-bold">{count}</span> 次，已记录到 DAC，多次违规可能导致封号。
            </p>
            <Button variant="destructive" className="w-full" onClick={() => setWarn(false)}>我知道了，继续对局</Button>
          </div>
        </div>
      )}
    </>
  );
};

export default DacBadge;
