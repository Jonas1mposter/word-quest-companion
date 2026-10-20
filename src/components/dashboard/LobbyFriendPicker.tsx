import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canTeamUp2v2 } from "@/lib/partyRules";
import type { LobbyPlayer } from "@/hooks/useLobbyParty";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grade: number;
  friends: LobbyPlayer[];
  loading: boolean;
  busy: boolean;
  onInvite: (friend: LobbyPlayer) => void;
  onRetry: () => void;
}
export default function LobbyFriendPicker({ open, onOpenChange, grade, friends, loading, busy, onInvite, onRetry }: Props) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>邀请好友组队</DialogTitle></DialogHeader>
      {loading ? <div role="status" className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : <div className="max-h-[55vh] space-y-2 overflow-y-auto">
          {!friends.length && <div className="py-8 text-center text-muted-foreground">暂无好友</div>}
          {friends.map(friend => <div key={friend.id} className="flex items-center gap-3 border-b border-border py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
              {friend.avatar_url ? <img src={friend.avatar_url} alt="" className="h-full w-full object-cover" /> : friend.username.charAt(0)}
            </div>
            <div className="min-w-0 flex-1"><div data-no-translate className="truncate font-semibold">{friend.username}</div>
              <div className="text-xs text-muted-foreground">G{friend.grade} · Lv.{friend.level}</div></div>
            <Button size="icon" variant="outline" disabled={busy || !canTeamUp2v2(grade, friend.grade)}
              aria-label={`邀请 ${friend.username}`} title={canTeamUp2v2(grade, friend.grade) ? "邀请好友组队" : "年级不同，无法组队"}
              onClick={() => onInvite(friend)}><UserPlus className="h-4 w-4" /></Button>
          </div>)}
        </div>}
      <Button variant="outline" disabled={loading} onClick={onRetry}>刷新</Button>
    </DialogContent>
  </Dialog>;
}