import { useState } from "react";
import { ChevronLeft, ChevronRight, Music4 } from "lucide-react";
import { setSoundVariant, useSoundVariants } from "@/hooks/useMatchSounds";
import { cn } from "@/lib/utils";

const VARIANT_LABELS: Record<string, { name: string; sub: string }> = {
  ignition: { name: "Ignition", sub: "点火" },
  lawyer: { name: "Lawyer", sub: "律师" },
  raja: { name: "Raja", sub: "王者" },
  renegade: { name: "Renegade", sub: "叛客" },
  watch: { name: "Watch", sub: "守望" },
};

/** 局内音效侧边栏：当前音效包含多套变体（如 ORA X 颗秒）时显示，显示每套的连击图标和名称，可随时切换。 */
const SoundVariantSwitcher = () => {
  const { variants, selected, icons } = useSoundVariants();
  const [open, setOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 1024);
  if (!variants) return null;
  const keys = Object.keys(variants);

  return (
    <aside
      aria-label="连杀音效切换"
      className={cn(
        "fixed right-0 top-1/2 z-40 -translate-y-1/2 flex items-stretch border-y border-l border-primary/40 bg-card/95 backdrop-blur shadow-lg transition-all",
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "收起音效栏" : "展开音效栏"}
        className="flex w-7 flex-col items-center justify-center gap-2 border-r border-border text-primary hover:bg-muted"
      >
        {open ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        <Music4 className="h-4 w-4" />
      </button>
      <div className="flex flex-col gap-1 p-2">
        {open && <div className="px-1 pb-1 text-[10px] font-semibold text-muted-foreground">连杀音效 · 局内切换</div>}
        {keys.map((k) => {
          const label = VARIANT_LABELS[k] ?? { name: k, sub: "" };
          const icon = icons?.[k]?.[0];
          const active = k === selected;
          return (
            <button
              key={k}
              onClick={() => setSoundVariant(k)}
              title={`${label.name} ${label.sub}`}
              aria-pressed={active}
              className={cn(
                "flex items-center gap-2 border px-1.5 py-1 text-left transition-colors",
                active ? "border-primary bg-primary/15" : "border-transparent hover:bg-muted",
              )}
            >
              <div className="h-10 w-10 shrink-0 overflow-hidden bg-background/60">
                {icon ? (
                  <img src={icon} alt={label.name} loading="eager" className="h-full w-full object-contain" />
                ) : (
                  <Music4 className="m-2.5 h-5 w-5 text-muted-foreground" />
                )}
              </div>
              {open && (
                <div className="min-w-[84px] pr-1">
                  <div className={cn("font-gaming text-xs", active ? "text-primary" : "text-foreground")}>{label.name}</div>
                  <div className="text-[10px] text-muted-foreground">{label.sub}</div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
};

export default SoundVariantSwitcher;
