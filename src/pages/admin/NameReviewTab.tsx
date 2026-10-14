import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCheck } from "lucide-react";

export const NameReviewTab = ({ onChanged }: { onChanged?: () => void }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("username_requests" as any).select("*")
      .eq("status", "pending").order("created_at", { ascending: true });
    setRows((data as any[]) || []);
  };
  useEffect(() => { load(); }, []);

  const review = async (id: string, approve: boolean) => {
    setBusy(id);
    const { error } = await supabase.rpc("review_username_request" as any, { p_request_id: id, p_approve: approve });
    setBusy(null);
    if (error) return toast.error("操作失败：" + error.message);
    toast.success(approve ? "已同意改名" : "已拒绝");
    load();
    onChanged?.();
  };

  return (
    <Card className="card-glow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><UserCheck className="w-5 h-5 text-primary" />改名审核</CardTitle>
        <CardDescription>玩家改名需管理员同意后才生效</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">暂无待审核的改名申请</p> :
          rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 border border-border">
              <div className="flex-1 min-w-0 text-sm">
                <span className="text-muted-foreground">{r.old_username}</span> → <b>{r.new_username}</b>
                <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              </div>
              <Button size="sm" variant="hero" disabled={busy === r.id} onClick={() => review(r.id, true)}>同意</Button>
              <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => review(r.id, false)}>拒绝</Button>
            </div>
          ))}
      </CardContent>
    </Card>
  );
};
