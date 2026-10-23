import { Button } from "@/components/ui/button";
import { Loader2, RotateCcw, ChevronLeft } from "lucide-react";

export function LearningOptionsStatus({ loading, onRetry, onBack }: { loading: boolean; onRetry: () => void; onBack: () => void }) {
  return <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-6">
    {loading ? <Loader2 className="animate-spin text-primary" /> : <p role="alert" className="text-destructive">选项加载失败，请重试</p>}
    <div className="flex gap-3">
      <Button variant="outline" onClick={onBack}><ChevronLeft />返回</Button>
      {!loading && <Button onClick={onRetry}><RotateCcw />重试</Button>}
    </div>
  </div>;
}