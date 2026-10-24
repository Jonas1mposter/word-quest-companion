import { useState } from "react";
import { Music4, ChevronUp, ChevronDown } from "lucide-react";
import { setSoundVariant, useSoundVariants } from "@/hooks/useMatchSounds";
import { cn } from "@/lib/utils";

const VARIANT_LABELS: Record<string, string> = {
  ignition: "Ignition 点火",
  lawyer: "Lawyer 律师",
  raja: "Raja 王者",
  renegade: "Renegade 叛客",
  watch: "Watch 守望",
};

/** 局内音效控制台：当前音效包含多套变体（如 ORA X 颗秒）时显示，可随时切换。 */
const SoundVariantSwitcher = () => {
  const { variants, selected } = useSoundVariants();
  const [open, setOpen] = useState(false);
  if (!variants) return null;
  const keys = Object.keys(variants);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="border border-border bg-card/95 backdrop-blur p-2 space-y-1 shadow-lg">
          <div className="px-1 pb-1 text-[10px] font-semibold text-muted-foreground">连杀音效 · 局内切换</div>
          {keys.map((k) => (
            <button
              key={k}
              onClick={() => setSoundVariant(k)}
              className={cn(
                "block w-full px-3 py-1.5 text-left text-xs font-gaming transition-colors",
                k === selected ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {VARIANT_LABELS[k] ?? k}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 border border-primary/50 bg-card/95 px-3 py-1.5 text-xs font-gaming text-primary shadow-lg backdrop-blur"
        aria-label="切换连杀音效"
      >
        <Music4 className="h-3.5 w-3.5" />
        {VARIANT_LABELS[selected ?? ""] ?? selected ?? "音效"}
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>
    </div>
  );
};

export default SoundVariantSwitcher;
