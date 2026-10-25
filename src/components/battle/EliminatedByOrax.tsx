import oraxIcon from "@/assets/kill-sounds/orax/orax.png.asset.json";

/** 被装备 ORA X 颗秒的对手击败时显示在失败结算页。 */
const EliminatedByOrax = ({ by }: { by?: string | null }) => (
  <div className="my-4 flex items-center justify-center gap-3 border-y border-destructive/50 bg-destructive/10 px-4 py-3 animate-fade-in" data-no-translate>
    <img src={oraxIcon.url} alt="ORA X" width={44} height={44} className="h-11 w-11 object-contain" />
    <div className="text-left">
      <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Eliminated by</div>
      <div className="font-gaming text-lg tracking-wide text-destructive">ORA X One Tap</div>
      {by && <div className="text-xs text-muted-foreground">{by}</div>}
    </div>
  </div>
);

export default EliminatedByOrax;
