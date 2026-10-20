import { contentGrade } from "@/lib/zones";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Swords, Users, Loader2, Crown, XCircle, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import Battle2v2Arena from "../Battle2v2Arena";

interface Party {
  id: string;
  leader_id: string;
  member_id: string | null;
  invited_id: string | null;
  status: string;
  match_id: string | null;
  grade: number;
  subject: string;
  expires_at: string;
}

interface PlayerBrief {
  id: string;
  username: string;
  avatar_url: string | null;
  grade: number;
  level: number;
}

interface Props {
  onBack: () => void;
  subject?: string;
}

type Stage = "choose" | "pick" | "room";

const Avatar = ({ url, name, className = "w-12 h-12 text-xl" }: { url: string | null; name: string; className?: string }) => (
  <div className={`${className} rounded-full bg-primary/20 flex items-center justify-center font-bold overflow-hidden shrink-0`}>
    {url ? <img src={url} alt={name} className="w-full h-full object-cover" /> : name.charAt(0).toUpperCase()}
  </div>
);

const Battle2v2Lobby = ({ onBack, subject = "mixed" }: Props) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [stage, setStage] = useState<Stage>("choose");
  const [party, setParty] = useState<Party | null>(null);
  const [friends, setFriends] = useState<PlayerBrief[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [busy, setBusy] = useState(false);
  const [solo, setSolo] = useState(false);
  const [started, setStarted] = useState(false);
  const [matchedId, setMatchedId] = useState<string | null>(null);
  const [teammate, setTeammate] = useState<PlayerBrief | null>(null);

  const isLeader = !!party && !!profile && party.leader_id === profile.id;
  const partyReady = !!party && party.status === "ready" && !!party.member_id;

  // 恢复进行中的队伍（例如接受邀请后进入、或中途返回大厅）
  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from("match_parties")
        .select("*")
        .or(`leader_id.eq.${profile.id},member_id.eq.${profile.id}`)
        .in("status", ["pending", "ready", "queued"])
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1);
      const p = data?.[0] as Party | undefined;
      if (p) {
        setParty(p);
        setStage("room");
      }
    })();
  }, [profile?.id]);

  // 订阅队伍状态变化（含 3 秒兜底轮询）
  useEffect(() => {
    if (!party) return;
    const partyId = party.id;

    const applyRow = (p: Party) => {
      if (p.status === "matched" && p.match_id) {
        setMatchedId(p.match_id);
        return;
      }
      if (p.status === "closed") {
        setParty(null);
        setStage("choose");
        toast({ title: "队伍已解散" });
        return;
      }
      if (new Date(p.expires_at).getTime() < Date.now()) {
        setParty(null);
        setStage("choose");
        toast({ title: "组队邀请已过期" });
        return;
      }
      setParty(p);
    };

    const channel = supabase
      .channel(`party-${partyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_parties", filter: `id=eq.${partyId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setParty(null);
            setStage("choose");
            toast({ title: "队伍已解散" });
            return;
          }
          applyRow(payload.new as Party);
        }
      )
      .subscribe();

    const poll = setInterval(async () => {
      const { data } = await supabase.from("match_parties").select("*").eq("id", partyId).maybeSingle();
      if (!data) {
        setParty(null);
        setStage("choose");
        return;
      }
      applyRow(data as Party);
    }, 3000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party?.id]);

  // 加载队友/被邀请者资料
  useEffect(() => {
    if (!party || !profile) {
      setTeammate(null);
      return;
    }
    const otherId = party.leader_id === profile.id ? party.member_id || party.invited_id : party.leader_id;
    if (!otherId) {
      setTeammate(null);
      return;
    }
    supabase
      .from("profiles")
      .select("id, username, avatar_url, grade, level")
      .eq("id", otherId)
      .single()
      .then(({ data }) => setTeammate(data as PlayerBrief | null));
  }, [party?.leader_id, party?.member_id, party?.invited_id, profile?.id]);

  const loadFriends = async () => {
    if (!profile) return;
    setLoadingFriends(true);
    try {
      const { data } = await supabase
        .from("friendships")
        .select(`
          id, user1_id, user2_id,
          user1:profiles!friendships_user1_id_fkey(id, username, avatar_url, grade, level),
          user2:profiles!friendships_user2_id_fkey(id, username, avatar_url, grade, level)
        `)
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`);
      const list = (data || [])
        .map((f: any) => (f.user1_id === profile.id ? f.user2 : f.user1))
        .filter(Boolean) as PlayerBrief[];
      setFriends(list);
    } catch (e) {
      console.error("Load friends error:", e);
    } finally {
      setLoadingFriends(false);
    }
  };

  const createParty = async (friend: PlayerBrief) => {
    if (!profile) return;
    setBusy(true);
    try {
      // 关闭我之前未完成的队伍
      await supabase
        .from("match_parties")
        .update({ status: "closed" })
        .eq("leader_id", profile.id)
        .in("status", ["pending", "ready"]);

      const { data, error } = await supabase
        .from("match_parties")
        .insert({
          leader_id: profile.id,
          invited_id: friend.id,
          grade: contentGrade(profile.grade),
          subject,
        })
        .select()
        .single();
      if (error) throw error;
      setParty(data as Party);
      setStage("room");
      toast({ title: "邀请已发送", description: `等待 ${friend.username} 接受组队邀请...` });
    } catch (e: any) {
      console.error("Create party error:", e);
      toast({ title: "创建队伍失败", description: e?.message || "请稍后重试", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const closeParty = async () => {
    if (!party || !profile) return;
    try {
      if (party.leader_id === profile.id) {
        await supabase.from("match_parties").delete().eq("id", party.id);
      } else {
        await supabase.from("match_parties").update({ status: "closed", member_id: null }).eq("id", party.id);
      }
    } catch (e) {
      console.error("Close party error:", e);
    }
    setParty(null);
    setStage("choose");
  };

  if (!profile) return null;

  // 单排：直接进入匹配
  if (solo) {
    return <Battle2v2Arena subject={subject} onBack={onBack} />;
  }

  // 队长开始匹配：带 partyId 进入
  if (started && party) {
    return <Battle2v2Arena subject={subject} partyId={party.id} onBack={onBack} />;
  }

  // 队员：队伍已匹配成功，直接进入对局
  if (matchedId) {
    return <Battle2v2Arena subject={subject} initialMatchId={matchedId} onBack={onBack} />;
  }

  const myGrade = contentGrade(profile.grade);

  if (stage === "pick") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card variant="glow" className="max-w-md w-full p-6">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" size="icon" onClick={() => setStage("choose")}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-gaming flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              邀请好友组队
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            2v2 按年级匹配，只能邀请同年级（{myGrade} 年级）的好友。
          </p>
          {loadingFriends ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              加载中...
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              还没有好友，先去好友页面添加吧！
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {friends.map((f) => {
                const sameGrade = contentGrade(f.grade) === myGrade;
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar url={f.avatar_url} name={f.username} className="w-10 h-10 text-base" />
                      <div className="min-w-0">
                        <div className="font-medium truncate">{f.username}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.grade}年级 · Lv.{f.level}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      disabled={!sameGrade || busy}
                      onClick={() => createParty(f)}
                      title={sameGrade ? "邀请组队" : "年级不同，无法组队"}
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "邀请"}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    );
  }

  if (stage === "room" && party) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card variant="glow" className="max-w-md w-full p-8 text-center">
          <h2 className="text-2xl font-gaming mb-6 flex items-center justify-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            2v2 组队房间
          </h2>
          <div className="flex items-center justify-center gap-6 mb-6">
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <Avatar url={profile.avatar_url} name={profile.username} className="w-16 h-16 text-2xl" />
                <Crown className="w-5 h-5 text-yellow-400 absolute -top-2 -right-2" />
              </div>
              <span className="text-sm font-medium truncate max-w-[100px]">{profile.username}</span>
              <Badge variant="outline" className="text-xs">队长</Badge>
            </div>
            <div className="text-3xl font-gaming text-muted-foreground">+</div>
            <div className="flex flex-col items-center gap-2">
              {teammate ? (
                <>
                  <Avatar url={teammate.avatar_url} name={teammate.username} className="w-16 h-16 text-2xl" />
                  <span className="text-sm font-medium truncate max-w-[100px]">{teammate.username}</span>
                  <Badge variant={partyReady ? "default" : "secondary"} className="text-xs">
                    {partyReady ? "已就位" : "等待接受..."}
                  </Badge>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                  <span className="text-sm text-muted-foreground">等待队友</span>
                </>
              )}
            </div>
          </div>

          {isLeader ? (
            <div className="space-y-3">
              {partyReady ? (
                <Button className="w-full" size="lg" onClick={() => setStarted(true)}>
                  <Swords className="w-4 h-4 mr-2" />
                  开始匹配
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">邀请已发送，等待队友接受...</p>
              )}
              <Button variant="outline" className="w-full" onClick={closeParty}>
                <XCircle className="w-4 h-4 mr-2" />
                解散队伍
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {partyReady ? "已加入队伍，等待队长开始匹配..." : "等待队伍就绪..."}
              </p>
              <Button variant="outline" className="w-full" onClick={closeParty}>
                <XCircle className="w-4 h-4 mr-2" />
                离开队伍
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  // 入口：选择单排或组队
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-2xl font-gaming">2v2 排位赛</h2>
        </div>
        <div className="grid gap-4">
          <Card
            variant="glow"
            className="p-6 cursor-pointer hover:border-primary/60 transition-colors"
            onClick={() => setSolo(true)}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-primary/15 flex items-center justify-center">
                <Swords className="w-7 h-7 text-primary" />
              </div>
              <div>
                <div className="font-gaming text-lg">单排匹配</div>
                <div className="text-sm text-muted-foreground">随机匹配队友和对手</div>
              </div>
            </div>
          </Card>
          <Card
            variant="glow"
            className="p-6 cursor-pointer hover:border-primary/60 transition-colors"
            onClick={() => {
              setStage("pick");
              void loadFriends();
            }}
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-yellow-500/15 flex items-center justify-center">
                <Users className="w-7 h-7 text-yellow-400" />
              </div>
              <div>
                <div className="font-gaming text-lg">邀请好友组队</div>
                <div className="text-sm text-muted-foreground">和同年级好友并肩作战</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Battle2v2Lobby;
