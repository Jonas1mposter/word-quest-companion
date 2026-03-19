import { Button } from "@/components/ui/button";
import { ChevronLeft, History } from "lucide-react";
const MatchHistory = ({ onBack }: { onBack: () => void }) => (
  <div className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="text-center"><History className="w-16 h-16 text-muted-foreground mx-auto mb-4" /><h2 className="text-xl font-bold mb-4">战绩记录</h2><p className="text-muted-foreground mb-6">本地模式暂无对战记录</p><Button variant="outline" onClick={onBack}><ChevronLeft className="w-4 h-4 mr-2" />返回</Button></div>
  </div>
);
export default MatchHistory;
