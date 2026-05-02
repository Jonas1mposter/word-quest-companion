import { Globe } from "lucide-react";
import BattleArena from "./battle/BattleArena";

interface FreeMatchBattleProps {
  onBack: () => void;
  initialMatchId?: string | null;
  subject?: string;
}

const FreeMatchBattle = ({ onBack, initialMatchId, subject = "mixed" }: FreeMatchBattleProps) => (
  <BattleArena
    onBack={onBack}
    initialMatchId={initialMatchId}
    subject={subject}
    matchType="free"
    eloField="elo_free"
    theme={{
      accentText: "text-neon-cyan",
      accentSpinner: "border-neon-cyan/30 border-t-neon-cyan",
      searchingTitle: "自由匹配中...",
      searchingSubtitle: ({ elo }) => `自由服 · ELO ${elo}`,
      Icon: Globe,
      winsField: "free_match_wins",
      lossesField: "free_match_losses",
    }}
  />
);

export default FreeMatchBattle;
