import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import classicIcon from "@/assets/kill-sounds/icons/classic.png.asset.json";
import gaiaIcon from "@/assets/kill-sounds/icons/gaia.png.asset.json";
import primeIcon from "@/assets/kill-sounds/icons/prime.png.asset.json";
import evoriIcon from "@/assets/kill-sounds/icons/evori.png.asset.json";
import forsakenIcon from "@/assets/kill-sounds/icons/forsaken.png.asset.json";

interface Props {
  combo: number;
}

const TIERS = [
  { label: "First Blood", sub: "首杀", color: "from-emerald-400 to-emerald-600", glow: "shadow-[0_0_40px_rgba(52,211,153,0.8)]", icon: classicIcon.url },
  { label: "Double Kill", sub: "双杀", color: "from-sky-400 to-blue-600", glow: "shadow-[0_0_40px_rgba(56,189,248,0.8)]", icon: gaiaIcon.url },
  { label: "Triple Kill", sub: "三杀", color: "from-violet-400 to-purple-600", glow: "shadow-[0_0_40px_rgba(167,139,250,0.9)]", icon: primeIcon.url },
  { label: "Quadra Kill", sub: "四杀", color: "from-pink-400 to-fuchsia-600", glow: "shadow-[0_0_50px_rgba(244,114,182,0.9)]", icon: evoriIcon.url },
  { label: "PENTA KILL", sub: "超神 · 无人能敌", color: "from-yellow-300 via-amber-500 to-red-600", glow: "shadow-[0_0_60px_rgba(250,204,21,1)]", icon: forsakenIcon.url },
];

export const KillStreakBanner = ({ combo }: Props) => {
  const [shown, setShown] = useState<number>(0);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (combo >= 1) {
      setShown(combo);
      setKey(k => k + 1);
      const t = setTimeout(() => setShown(0), 1400);
      return () => clearTimeout(t);
    } else {
      setShown(0);
    }
  }, [combo]);

  if (shown < 1) return null;
  const tier = TIERS[Math.min(shown, 5) - 1];

  return (
    <div
      key={key}
      className="pointer-events-none fixed inset-x-0 top-28 z-50 flex justify-center px-4 animate-in fade-in zoom-in-50 slide-in-from-top-4 duration-300"
    >
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl px-6 py-3 bg-gradient-to-r text-white border border-white/30 backdrop-blur-md",
          tier.color,
          tier.glow,
          shown >= 5 && "animate-pulse"
        )}
      >
        <img
          src={tier.icon}
          alt=""
          className={cn(
            "w-10 h-10 drop-shadow-lg object-contain",
            shown >= 4 && "animate-bounce"
          )}
        />
        <div className="flex flex-col leading-tight">
          <span className="font-gaming text-xl sm:text-2xl tracking-wider drop-shadow-md">
            {tier.label}
          </span>
          <span className="text-[11px] sm:text-xs opacity-90">{tier.sub} · {shown} 连击</span>
        </div>
        <img
          src={tier.icon}
          alt=""
          className={cn(
            "w-10 h-10 drop-shadow-lg object-contain",
            shown >= 4 && "animate-bounce"
          )}
        />
      </div>
    </div>
  );
};

export default KillStreakBanner;
