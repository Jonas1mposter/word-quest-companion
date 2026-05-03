import { Star, Flame, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { BestRecords, tierColors, tierNames } from "./constants";

export const BestRecordsSection = ({ bestRecords }: { bestRecords: BestRecords }) => {
  return (
    <div className="px-4 py-3 border-t border-border/50">
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4 text-accent" />
        <span className="text-sm font-medium text-muted-foreground">历史最佳</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-success/10 border border-success/20">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-4 h-4 text-success" />
            <span className="text-xs text-muted-foreground">最高连胜</span>
          </div>
          <div className="text-xl font-gaming text-success">{bestRecords.bestWinStreak}</div>
        </div>

        <div className={cn(
          "p-3 rounded-lg border border-border/40",
          tierColors[bestRecords.bestRankTier].bg
        )}>
          <div className="flex items-center gap-2 mb-1">
            <Crown className={cn("w-4 h-4", tierColors[bestRecords.bestRankTier].text)} />
            <span className="text-xs text-muted-foreground">最高段位</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("text-lg font-gaming", tierColors[bestRecords.bestRankTier].text)}>
              {tierNames[bestRecords.bestRankTier]}
            </span>
            <span className="text-xs text-muted-foreground">
              {bestRecords.bestRankStars}星
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
