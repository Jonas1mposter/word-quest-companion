import { Button } from "@/components/ui/button";
import { ChevronLeft, Eye } from "lucide-react";
const SpectateView = ({ onBack }: { matchId: string; onBack: () => void }) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="text-center"><Eye className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h2 className="text-xl font-bold mb-4">观战功能暂不可用</h2><Button variant="outline" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-2" />返回</Button></div>
  </div>
);
export default SpectateView;
