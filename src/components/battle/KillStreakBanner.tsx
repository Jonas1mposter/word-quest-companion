import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

import c1 from "@/assets/kill-sounds/tier-icons/classic_1.png.asset.json";
import c2 from "@/assets/kill-sounds/tier-icons/classic_2.png.asset.json";
import c3 from "@/assets/kill-sounds/tier-icons/classic_3.png.asset.json";
import c4 from "@/assets/kill-sounds/tier-icons/classic_4.png.asset.json";
import c5 from "@/assets/kill-sounds/tier-icons/classic_5.png.asset.json";

interface Props {
  combo: number;
}

const DEFAULT_ICONS = [c1.url, c2.url, c3.url, c4.url, c5.url];

const TIERS = [
  { label: "First Blood", sub: "首杀", color: "from-emerald-400 to-emerald-600", glow: "shadow-[0_0_40px_rgba(52,211,153,0.8)]" },
  { label: "Double Kill", sub: "双杀", color: "from-sky-400 to-blue-600", glow: "shadow-[0_0_40px_rgba(56,189,248,0.8)]" },
  { label: "Triple Kill", sub: "三杀", color: "from-violet-400 to-purple-600", glow: "shadow-[0_0_40px_rgba(167,139,250,0.9)]" },
  { label: "Quadra Kill", sub: "四杀", color: "from-pink-400 to-fuchsia-600", glow: "shadow-[0_0_50px_rgba(244,114,182,0.9)]" },
  { label: "PENTA KILL", sub: "超神 · 无人能敌", color: "from-yellow-300 via-amber-500 to-red-600", glow: "shadow-[0_0_60px_rgba(250,204,21,1)]" },
];

let cachedIcons: string[] | null = null;
let iconsLoading: Promise<string[]> | null = null;

const loadIcons = async (): Promise<string[]> => {
  if (cachedIcons) return cachedIcons;
  if (iconsLoading) return iconsLoading;
  iconsLoading = (async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return DEFAULT_ICONS;
      const { data: prof } = await supabase
        .from("profiles")
        .select("active_kill_sound_pack_id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!prof?.active_kill_sound_pack_id) return DEFAULT_ICONS;
      const { data: pack } = await supabase
        .from("kill_sound_packs")
        .select("icon_urls")
        .eq("id", prof.active_kill_sound_pack_id)
        .maybeSingle();
      const urls = (pack as any)?.icon_urls as string[] | undefined;
      if (Array.isArray(urls) && urls.length === 5) {
        cachedIcons = urls;
        return urls;
      }
    } catch (e) { /* ignore */ }
    return DEFAULT_ICONS;
  })();
  return iconsLoading;
};

export const reloadKillStreakIcons = () => {
  cachedIcons = null;
  iconsLoading = null;
};

export const KillStreakBanner = ({ combo }: Props) => {
  const [shown, setShown] = useState<number>(0);
  const [key, setKey] = useState(0);
  const [icons, setIcons] = useState<string[]>(cachedIcons ?? DEFAULT_ICONS);

  useEffect(() => {
    loadIcons().then((urls) => setIcons(urls));
  }, []);

  useEffect(() => {
    if (combo >= 1) {
      setShown(combo);
      setKey((k) => k + 1);
      const t = setTimeout(() => setShown(0), 1400);
      return () => clearTimeout(t);
    } else {
      setShown(0);
    }
  }, [combo]);

  if (shown < 1) return null;
  const tierIdx = Math.min(shown, 5) - 1;
  const tier = TIERS[tierIdx];
  const iconUrl = icons[tierIdx] ?? DEFAULT_ICONS[tierIdx];

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
          src={iconUrl}
          alt=""
          className={cn(
            "w-12 h-12 drop-shadow-lg object-contain",
            shown >= 4 && "animate-bounce"
          )}
        />
        <div className="flex flex-col leading-tight">
          <span className="font-gaming text-xl sm:text-2xl tracking-wider drop-shadow-md">
            {tier.label}
          </span>
          <span className="text-[11px] sm:text-xs opacity-90">
            {tier.sub} · {shown} 连击
          </span>
        </div>
        <img
          src={iconUrl}
          alt=""
          className={cn(
            "w-12 h-12 drop-shadow-lg object-contain",
            shown >= 4 && "animate-bounce"
          )}
        />
      </div>
    </div>
  );
};

export default KillStreakBanner;
