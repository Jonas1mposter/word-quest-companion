import { ShieldCheck } from "lucide-react";

/**
 * DAC（Dipont Anti-Cheat）对局内常驻角标，固定在右下角。
 * 仅作展示，不拦截任何交互。
 */
const DacBadge = () => (
  <div className="fixed bottom-3 right-3 z-50 pointer-events-none select-none">
    <div className="val-cut-sm flex items-center gap-1.5 px-2.5 py-1.5 bg-background/85 backdrop-blur border border-primary/50 shadow-[0_0_12px_hsl(var(--primary)/0.25)]">
      <ShieldCheck className="w-3.5 h-3.5 text-primary animate-pulse" />
      <span className="font-tactical text-[10px] uppercase tracking-widest text-muted-foreground leading-none">
        Dipont Anti-Cheat <span className="text-primary">启动中</span>
      </span>
    </div>
  </div>
);

export default DacBadge;
