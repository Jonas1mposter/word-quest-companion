import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { canHostStartParty, canTeamUp2v2 } from "@/lib/partyRules";
import { contentGrade } from "@/lib/zones";
import { toast } from "sonner";

export interface LobbyParty {
  id: string;
  leader_id: string;
  member_id: string | null;
  invited_id: string | null;
  status: string;
  match_id: string | null;
  subject: string;
  expires_at: string;
}
export interface LobbyPlayer {
  id: string;
  username: string;
  grade: number;
  level: number;
  rank_tier: string;
  avatar_url: string | null;
  lobby_card_image: string | null;
}

export function useLobbyParty(profile: { id: string; grade: number } | null) {
  const [party, setParty] = useState<LobbyParty | null>(null);
  const [teammate, setTeammate] = useState<LobbyPlayer | null>(null);
  const [friends, setFriends] = useState<LobbyPlayer[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [busy, setBusy] = useState(false);
  const profileId = profile?.id;

  const restore = useCallback(async () => {
    if (!profileId) return;
    const { data, error } = await supabase.from("match_parties").select("*")
      .or(`leader_id.eq.${profileId},member_id.eq.${profileId}`)
      .in("status", ["pending", "ready", "queued", "matched"])
      .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
    if (error) return;
    const row = data?.[0];
    if (row?.status === "matched" && row.match_id) {
      const { data: match } = await supabase.from("ranked_matches").select("status").eq("id", row.match_id).maybeSingle();
      if (match?.status === "completed") { setParty(null); return; }
    }
    setParty(row ?? null);
  }, [profileId]);

  useEffect(() => {
    setParty(null);
    setTeammate(null);
    void restore();
    const accepted = () => void restore();
    window.addEventListener("party-2v2-accepted", accepted);
    window.addEventListener("online", accepted);
    return () => {
      window.removeEventListener("party-2v2-accepted", accepted);
      window.removeEventListener("online", accepted);
    };
  }, [restore]);

  useEffect(() => {
    if (!party) return;
    let active = true;
    let loading = false;
    const id = party.id;
    const apply = (row: LobbyParty | null) => {
      if (!active) return;
      if (!row || row.status === "closed" || (row.status !== "matched" && Date.parse(row.expires_at) <= Date.now())) {
        setParty(null);
        toast.info("队伍已解散或邀请已过期");
      } else setParty(row);
    };
    const channel = supabase.channel(`lobby-party-${id}`).on("postgres_changes",
      { event: "*", schema: "public", table: "match_parties", filter: `id=eq.${id}` },
      payload => apply(payload.eventType === "DELETE" ? null : payload.new as LobbyParty)).subscribe();
    const poll = setInterval(async () => {
      if (loading) return;
      loading = true;
      try {
        const { data, error } = await supabase.from("match_parties").select("*").eq("id", id).maybeSingle();
        if (!error) apply(data);
      } finally { loading = false; }
    }, 3000);
    return () => { active = false; clearInterval(poll); void supabase.removeChannel(channel); };
  }, [party?.id]);

  const otherId = party?.leader_id === profileId ? party?.member_id || party?.invited_id : party?.leader_id;
  useEffect(() => {
    let active = true;
    setTeammate(null);
    if (!otherId) return;
    const load = async () => {
      const { data } = await supabase.from("profiles")
        .select("id, username, grade, level, rank_tier, avatar_url, lobby_card_image").eq("id", otherId).maybeSingle();
      if (active) setTeammate(data);
    };
    void load();
    const channel = supabase.channel(`lobby-teammate-${otherId}`).on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${otherId}` }, () => void load()).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [otherId]);

  const loadFriends = async () => {
    if (!profileId) return;
    setLoadingFriends(true);
    try {
      const { data, error } = await supabase.from("friendships").select("user1_id, user2_id")
        .or(`user1_id.eq.${profileId},user2_id.eq.${profileId}`);
      if (error) throw error;
      const ids = (data ?? []).map(row => row.user1_id === profileId ? row.user2_id : row.user1_id);
      if (!ids.length) { setFriends([]); return; }
      const { data: players, error: playersError } = await supabase.from("profiles")
        .select("id, username, grade, level, rank_tier, avatar_url, lobby_card_image").in("id", ids);
      if (playersError) throw playersError;
      setFriends(players ?? []);
    } catch { toast.error("好友加载失败，请重试"); }
    finally { setLoadingFriends(false); }
  };

  const invite = async (friend: LobbyPlayer): Promise<boolean> => {
    if (!profile || party || busy || !canTeamUp2v2(profile.grade, friend.grade)) return false;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("match_parties").insert({
        leader_id: profile.id, invited_id: friend.id, grade: contentGrade(profile.grade), subject: "mixed",
      }).select().single();
      if (error) throw error;
      setParty(data);
      toast.success("邀请已发送");
      return true;
    } catch { toast.error("创建队伍失败，请重试"); return false; }
    finally { setBusy(false); }
  };

  const leave = async (): Promise<boolean> => {
    if (!party || busy) return false;
    setBusy(true);
    try {
      const { error } = await supabase.from("match_parties").update({ status: "closed" }).eq("id", party.id);
      if (error) throw error;
      setParty(null);
      return true;
    } catch { toast.error("离开队伍失败，请重试"); return false; }
    finally { setBusy(false); }
  };

  const prepare = async (subject: string): Promise<boolean> => {
    if (!canHostStartParty(party, profileId) || !party || busy) return false;
    setBusy(true);
    try {
      const { data, error } = await supabase.from("match_parties").update({ subject }).eq("id", party.id)
        .eq("leader_id", profileId ?? "").eq("status", "ready").gt("expires_at", new Date().toISOString()).select().maybeSingle();
      if (error || !data) throw error ?? new Error("队伍已失效");
      setParty(data);
      return true;
    } catch { toast.error("队伍状态已变化，请重试"); return false; }
    finally { setBusy(false); }
  };

  return { party, teammate, friends, loadingFriends, busy, loadFriends, invite, leave, prepare,
    isHost: !party || party.leader_id === profileId,
    canStart: !party || canHostStartParty(party, profileId),
  };
}