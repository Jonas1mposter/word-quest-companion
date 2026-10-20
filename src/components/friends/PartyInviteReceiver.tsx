import { canTeamUp2v2 } from "@/lib/partyRules";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface PendingPartyInvite {
  id: string;
  leader_id: string;
  grade: number;
  subject: string;
  leader: {
    username: string;
    avatar_url: string | null;
    grade: number;
    level: number;
  };
}

/**
 * 全局 2v2 组队邀请接收器：挂在 Index 页面，任意页面都能收到邀请。
 * 接受后通过 window 事件通知 Dashboard 切换到 2v2 大厅。
 */
export const PartyInviteReceiver = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [invite, setInvite] = useState<PendingPartyInvite | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!profile) return;

    const loadInvite = async (row: any) => {
      const { data: leader } = await supabase
        .from("profiles")
        .select("username, avatar_url, grade, level")
        .eq("id", row.leader_id)
        .single();
      if (leader) {
        setInvite({
          id: row.id,
          leader_id: row.leader_id,
          grade: row.grade,
          subject: row.subject,
          leader,
        });
      }
    };

    // 进入页面时检查未处理的邀请
    supabase
      .from("match_parties")
      .select("id, leader_id, grade, subject")
      .eq("invited_id", profile.id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) void loadInvite(data[0]);
      });

    const channel = supabase
      .channel(`party-invites-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "match_parties",
          filter: `invited_id=eq.${profile.id}`,
        },
        (payload) => void loadInvite(payload.new)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const respond = async (accept: boolean) => {
    if (!invite || !profile) return;
    setProcessing(true);
    try {
      if (accept) {
        if (!canTeamUp2v2(profile.grade, invite.grade)) {
          toast({
            title: "无法组队",
            description: `对方创建的是 ${invite.grade} 年级场次，与你的年级不同`,
            variant: "destructive",
          });
          setInvite(null);
          return;
        }
        const { data, error } = await supabase
          .from("match_parties")
          .update({ member_id: profile.id, status: "ready" })
          .eq("id", invite.id)
          .eq("status", "pending")
          .gt("expires_at", new Date().toISOString())
          .select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("邀请已失效");

        toast({ title: "已加入队伍", description: "等待队长开始匹配..." });
        window.dispatchEvent(
          new CustomEvent("party-2v2-accepted", { detail: { partyId: invite.id } })
        );
      } else {
        await supabase
          .from("match_parties")
          .update({ status: "closed" })
          .eq("id", invite.id);
        toast({ title: "已拒绝", description: "已拒绝组队邀请" });
      }
      setInvite(null);
    } catch (e: any) {
      console.error("Respond to party invite error:", e);
      toast({
        title: "操作失败",
        description: e?.message || "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (!invite) return null;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            收到 2v2 组队邀请！
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold animate-pulse overflow-hidden">
            {invite.leader.avatar_url ? (
              <img
                src={invite.leader.avatar_url}
                alt={invite.leader.username}
                className="w-full h-full object-cover"
              />
            ) : (
              invite.leader.username.charAt(0).toUpperCase()
            )}
          </div>
          <div className="text-center">
            <div className="font-bold text-lg">{invite.leader.username}</div>
            <div className="text-sm text-muted-foreground">
              {invite.leader.grade}年级 · Lv.{invite.leader.level}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              邀请你组队参加 2v2 排位赛！
            </div>
          </div>

          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={() => respond(false)}
              disabled={processing}
              className="flex-1"
            >
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <X className="h-4 w-4 mr-1" />
                  拒绝
                </>
              )}
            </Button>
            <Button onClick={() => respond(true)} disabled={processing} className="flex-1">
              {processing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  接受
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
