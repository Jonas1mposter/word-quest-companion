import { useEffect, useSyncExternalStore } from "react";

/** ORA X 颗秒主套 kill_sound_packs.id —— 装备者击败对手时，对方结算页显示 Eliminated by ORA X One Tap。 */
export const ORAX_PACK_ID = "5e69a96b-db09-4555-94ef-d755b1c9b31a";

export const isOraxPlayer = (p: { active_kill_sound_pack_id?: string | null } | null | undefined) =>
  p?.active_kill_sound_pack_id === ORAX_PACK_ID;

/** 5 套局内色调，颜色取自 5 套连击图标的主色。 */
export const ORAX_TONES: Record<string, { name: string; sub: string; primary: string; fg: string; swatch: string }> = {
  ignition: { name: "Ignition", sub: "点火红", primary: "356 92% 60%", fg: "0 0% 100%", swatch: "hsl(356 92% 60%)" },
  lawyer: { name: "Lawyer", sub: "律师橙", primary: "23 72% 72%", fg: "213 28% 8%", swatch: "hsl(23 72% 72%)" },
  raja: { name: "Raja", sub: "王者蓝", primary: "210 85% 72%", fg: "213 28% 8%", swatch: "hsl(210 85% 72%)" },
  renegade: { name: "Renegade", sub: "叛客紫", primary: "262 89% 74%", fg: "213 28% 8%", swatch: "hsl(262 89% 74%)" },
  watch: { name: "Watch", sub: "守望绿", primary: "85 92% 60%", fg: "213 28% 8%", swatch: "hsl(85 92% 60%)" },
};

const KEY = "orax-ui-tone";
const listeners = new Set<() => void>();
let tone: string | null = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();

export const setOraxTone = (k: string) => {
  if (!ORAX_TONES[k]) return;
  tone = k;
  try { localStorage.setItem(KEY, k); } catch { /* ignore */ }
  listeners.forEach((l) => l());
};

export const useOraxTone = () =>
  useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => tone, () => tone);

const VARS = ["--primary", "--ring", "--accent", "--primary-foreground", "--accent-foreground"];

/** 在对局页面挂载期间把选中的色调写到根元素，卸载时恢复原主题。 */
export const useApplyOraxTone = (enabled: boolean, fallback: string | null) => {
  const selected = useOraxTone();
  const key = selected && ORAX_TONES[selected] ? selected : fallback && ORAX_TONES[fallback] ? fallback : null;
  useEffect(() => {
    if (!enabled || !key) return;
    const root = document.documentElement;
    const t = ORAX_TONES[key];
    root.style.setProperty("--primary", t.primary);
    root.style.setProperty("--ring", t.primary);
    root.style.setProperty("--accent", t.primary);
    root.style.setProperty("--primary-foreground", t.fg);
    root.style.setProperty("--accent-foreground", t.fg);
    root.dataset.oraxTone = key;
    return () => { VARS.forEach((v) => root.style.removeProperty(v)); delete root.dataset.oraxTone; };
  }, [enabled, key]);
  return key;
};
