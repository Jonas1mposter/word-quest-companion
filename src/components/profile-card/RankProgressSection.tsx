import { Badge } from "@/components/ui/badge";
import { Crown, Shield, Star, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { RANK_CONFIG, TIER_ORDER, RankTier, tierColors, tierNames } from "./constants";

interface Props {
  rankTier: RankTier;
  rankStars: number;
}

export const RankProgressSection = ({ rankTier, rankStars }: Props) => {
  const config = RANK_CONFIG[rankTier];
  const tierIndex = TIER_ORDER.indexOf(rankTier);
  const nextTier = tierIndex < TIER_ORDER.length - 1 ? TIER_ORDER[tierIndex + 1] : null;
  const progressPercent = rankTier === "champion"
    ? 100
    : Math.min((rankStars / config.starsToPromote) * 100, 100);

  return (
    <div className="px-4 py-3 border-t border-border/50">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br",
              tierColors[rankTier].gradient
            )}>
              {rankTier === "champion" ? <Crown className="w-4 h-4 text-white" /> : <Shield className="w-4 h-4 text-white" />}
            </div>
            <div>
              <div className={cn("font-gaming text-sm", tierColors[rankTier].text)}>
                {tierNames[rankTier]}
              </div>
              <div className="text-xs text-muted-foreground">
                {rankStars} / {config.starsToPromote} 星
              </div>
            </div>
          </div>

          {nextTier && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ChevronUp className="w-3 h-3" />
              <span>下一段位:</span>
              <span className={cn("font-gaming", tierColors[nextTier].text)}>
                {tierNames[nextTier]}
              </span>
            </div>
          )}

          {rankTier === "champion" && (
            <Badge variant="gold" className="text-xs">
              <Crown className="w-3 h-3 mr-1" />
              最高段位
            </Badge>
          )}
        </div>

        <div className="relative">
          <div className="h-3 bg-secondary/50 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 bg-gradient-to-r",
                tierColors[rankTier].gradient
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {rankTier !== "champion" && (
            <div className="absolute inset-0 flex items-center">
              {[0.25, 0.5, 0.75].map((pos) => (
                <div key={pos} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${pos * 100}%` }}>
                  <div className={cn(
                    "w-1 h-1 rounded-full",
                    progressPercent >= pos * 100 ? "bg-white/80" : "bg-muted-foreground/30"
                  )} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            {config.starsLostOnLose > 0 ? (
              <span>失败扣 {config.starsLostOnLose} 星</span>
            ) : (
              <span className="text-success">失败不扣星</span>
            )}
            {config.protectionStars > 0 && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <span className="text-accent">{config.protectionStars} 星保护</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-accent fill-accent" />
            <span>胜利 +1 星</span>
          </div>
        </div>
      </div>
    </div>
  );
};
