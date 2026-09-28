import { ShieldCheck } from "lucide-react";

/**
 * DAC（Dipont Anti-Cheat）对局内常驻角标，固定在右下角。
 * 仅作展示，不拦截任何交互。
 * status: 准备阶段显示「启动中」，答题阶段显示「监控中」。
 */
const DacBadge = ({ status = "监控中" }: { status?: "启动中" | "监控中" }) => (
  <div className="fixed bottom-3 right-3 z-50 pointer-events-none select-none">
    <div className="val-cut-sm flex items-center gap-1.5 px-2.5 py-1.5 bg-background/85 backdrop-blur border border-primary/50 shadow-[0_0_12px_hsl(var(--primary)/0.25)]">
      <ShieldCheck className="w-3.5 h-3.5 text-primary animate-pulse" />
      <span className="font-tactical text-[10px] uppercase tracking-widest text-muted-foreground leading-none">
        Dipont Anti-Cheat <span className="text-primary">{status}</span>
      </span>
    </div>
  </div>
);

export default DacBadge;
