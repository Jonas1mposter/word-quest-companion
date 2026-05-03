import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Swords, Trash2, RefreshCw } from "lucide-react";

interface Props {
  matchCount: number;
  setMatchCount: (n: number) => void;
  refresh: () => void;
}

export const MatchesTab = ({ matchCount, setMatchCount, refresh }: Props) => {
  const [clearing, setClearing] = useState(false);

  const clearAll = async () => {
    setClearing(true);
    try {
      const { error } = await supabase.from("ranked_matches")
        .delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      toast.success("已清除所有对局记录");
      setMatchCount(0);
    } catch { toast.error("清除失败"); }
    finally { setClearing(false); }
  };

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Swords className="w-5 h-5 text-destructive" />对局管理</CardTitle>
        <CardDescription>管理和清理对局记录</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
          <div>
            <div className="text-lg font-medium">当前对局数</div>
            <div className="text-sm text-muted-foreground">数据库中的所有对局记录</div>
          </div>
          <Badge variant="outline" className="text-lg px-4 py-2">{matchCount} 个</Badge>
        </div>

        <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <div className="font-medium text-destructive">危险操作警告</div>
              <ul className="text-sm text-muted-foreground mt-1 space-y-1">
                <li>• 清除所有对局将删除全部对战记录</li>
                <li>• 此操作不可恢复，请谨慎操作</li>
                <li>• 适用于修复匹配系统bug后的数据清理</li>
              </ul>
            </div>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={clearing || matchCount === 0} className="w-full" size="lg">
              <Trash2 className={`w-4 h-4 mr-2 ${clearing ? "animate-spin" : ""}`} />
              {clearing ? "清除中..." : `清除所有对局 (${matchCount}个)`}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认清除所有对局</AlertDialogTitle>
              <AlertDialogDescription>
                确定要清除所有 <strong>{matchCount}</strong> 个对局记录吗？此操作不可撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={clearAll}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                确认清除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button variant="outline" onClick={refresh} className="w-full">
          <RefreshCw className="w-4 h-4 mr-2" />刷新对局数量
        </Button>
      </CardContent>
    </Card>
  );
};
