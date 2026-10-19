import { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** 段位徽章外框特效：铂金起逐级叠加，狄邦巅峰最华丽 */
const FX_COLOR: Record<string, string> = {
  platinum: "#67e8f9",
  diamond: "#93c5fd",
  star: "#f0abfc",
  ace: "#fb923c",
  champion: "#facc15",
};
const LEVEL: Record<string, number> = { platinum: 1, diamond: 2, star: 3, ace: 4, champion: 5 };

export function rankFxLevel(tier?: string) {
  return LEVEL[tier || ""] ?? 0;
}

export default function RankEmblem({
  tier, className, rounded = "rounded-xl", children,
}: { tier: string; className?: string; rounded?: string; children: ReactNode }) {
  const lv = rankFxLevel(tier);
  const color = FX_COLOR[tier];
  const style = color ? ({ ["--rk" as any]: color } as CSSProperties) : undefined;
  return (
    <div className={cn("relative shrink-0", lv > 0 && "rk-wrap", className)} style={style}>
      {lv >= 5 && <span className="rk-rays" aria-hidden />}
      {lv >= 4 && <span className={cn("rk-flame", rounded)} aria-hidden />}
      {lv >= 2 && <span className={cn("rk-ring", rounded, lv >= 5 && "rk-ring-champ")} aria-hidden />}
      {lv >= 5 && <span className={cn("rk-ring rk-ring-rev", rounded)} aria-hidden />}
      <div className={cn("relative z-[2] w-full h-full overflow-hidden flex items-center justify-center", rounded, lv > 0 && "rk-core")}>
        {children}
        {lv >= 1 && <span className="rk-sheen" aria-hidden />}
      </div>
      {lv >= 3 && (
        <span className="rk-orbit" aria-hidden>
          {Array.from({ length: lv >= 5 ? 4 : 2 }).map((_, i) => (
            <span key={i} className="rk-orb" style={{ transform: `rotate(${(360 / (lv >= 5 ? 4 : 2)) * i}deg)` }} />
          ))}
        </span>
      )}
      {lv >= 5 && Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="rk-ember" aria-hidden style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.31) % 2.4}s` }} />
      ))}
    </div>
  );
}
