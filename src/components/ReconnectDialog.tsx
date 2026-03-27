import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Swords, Globe, XCircle } from "lucide-react";

interface ReconnectDialogProps {
  activeMatch: {
    id: string;
    type: "ranked" | "free";
    opponentName: string;
    opponentAvatar?: string;
    myScore: number;
    opponentScore: number;
    currentQuestion: number;
    timeRemaining: number;
  } | null;
  onReconnect: () => void;
  onDismiss: () => void;
}

export const ReconnectDialog = ({ activeMatch, onReconnect, onDismiss }: ReconnectDialogProps) => {
  if (!activeMatch) return null;

  const Icon = activeMatch.type === 'ranked' ? Swords : Globe;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            发现未完成的比赛
          </DialogTitle>
          <DialogDescription>
            你有一场正在进行的{activeMatch.type === 'ranked' ? '排位赛' : '自由服'}比赛
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
            <span className="text-sm">对手</span>
            <span className="font-semibold">{activeMatch.opponentName}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
            <span className="text-sm">当前比分</span>
            <span className="font-semibold">{activeMatch.myScore} : {activeMatch.opponentScore}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-secondary/20 rounded-lg">
            <span className="text-sm">剩余时间</span>
            <span className="font-semibold">{Math.floor(activeMatch.timeRemaining / 60)}:{Math.floor(activeMatch.timeRemaining % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onDismiss} className="flex-1">
            <XCircle className="w-4 h-4 mr-1" /> 放弃
          </Button>
          <Button onClick={onReconnect} className="flex-1">
            <Icon className="w-4 h-4 mr-1" /> 重连
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
