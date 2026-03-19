// Stub: RankedBattle requires real-time multiplayer (not available in localStorage mode)
import { Button } from "@/components/ui/button";
import { ChevronLeft, Swords } from "lucide-react";

interface RankedBattleProps { onBack: () => void; initialMatchId?: string | null; subject?: string; }

const RankedBattle = ({ onBack }: RankedBattleProps) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="text-center max-w-md">
      <Swords className="w-16 h-16 text-primary mx-auto mb-4" />
      <h2 className="text-2xl font-bold mb-2">排位赛</h2>
      <p className="text-muted-foreground mb-6">排位赛需要在线多人对战服务，当前为本地模式，暂不可用。</p>
      <Button variant="outline" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-2" />返回</Button>
    </div>
  </div>
);
export default RankedBattle;
