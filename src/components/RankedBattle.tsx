import { Swords } from "lucide-react";
import BattleArena from "./battle/BattleArena";

interface RankedBattleProps {
  onBack: () => void;
  initialMatchId?: string | null;
  subject?: string;
}

const RankedBattle = ({ onBack, initialMatchId, subject = "mixed" }: RankedBattleProps) => (
  <BattleArena
    onBack={onBack}
    initialMatchId={initialMatchId}
    subject={subject}
    matchType="ranked"
    eloField="elo_rating"
    theme={{
      accentText: "text-primary",
      accentSpinner: "border-primary/30 border-t-primary",
      searchingTitle: "正在匹配对手...",
      searchingSubtitle: ({ grade, elo }) => `排位赛 · ${grade}年级 · ELO ${elo}`,
      Icon: Swords,
      winsField: "wins",
      lossesField: "losses",
    }}
  />
);

export default RankedBattle;
