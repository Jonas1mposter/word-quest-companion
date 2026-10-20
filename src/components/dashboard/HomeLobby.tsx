import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Swords, ChevronRight, Plus, ImagePlus, Trash2, Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import PlayerStats from "../PlayerStats";
import RankDisplay from "../RankDisplay";
import DailyQuest from "../DailyQuest";
import CheckInCard from "./CheckInCard";
import { Button } from "@/components/ui/button";
import LobbyPlayerCard, { LOBBY_RANK_NAMES } from "./LobbyPlayerCard";
import LobbyFriendPicker from "./LobbyFriendPicker";
import type { useLobbyParty } from "@/hooks/useLobbyParty";
import { zoneName } from "@/lib/zones";
import ModeSelect from "./ModeSelect";
import LobbyCardCropper from "./LobbyCardCropper";
import type { DashboardView } from "./DashboardNav";

interface HomeLobbyProps {
  partyState: ReturnType<typeof useLobbyParty>;
  profile: any;
  grade: number;
  playerData: any;
  refreshKey: number;
  onEnergyPurchased: () => void;
  onNavigate: (view: DashboardView) => void;
  onStartMatch: () => void;
  onFreeMatch: () => void;
}

const HomeLobby = ({
  partyState, profile, grade, playerData, refreshKey,
  onEnergyPurchased, onNavigate, onStartMatch, onFreeMatch,
}: HomeLobbyProps) => {
  const [showFriends, setShowFriends] = useState(false);
  const { party, teammate, isHost, canStart } = partyState;
  const [showModes, setShowModes] = useState(false);
  const [customImage, setCustomImage] = useState<string | null>(profile?.lobby_card_image ?? null);
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCustomImage(profile?.lobby_card_image ?? null);
  }, [profile?.lobby_card_image]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !profile?.user_id) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      toast.error("请上传 JPG、PNG、GIF 或 WebP 格式的图片");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过 5MB");
      return;
    }
    setCropFile(file);
  };

  const uploadCroppedImage = async (blob: Blob) => {
    if (!profile?.user_id) return;
    setUploading(true);
    try {
      const fileName = `${profile.user_id}/lobby-${Date.now()}.jpg`;
      if (customImage) {
        const oldPath = customImage.split("/profile-backgrounds/")[1];
        if (oldPath) await supabase.storage.from("profile-backgrounds").remove([oldPath]);
      }
      const { error: upErr } = await supabase.storage
        .from("profile-backgrounds")
        .upload(fileName, blob, { upsert: true, contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("profile-backgrounds").getPublicUrl(fileName);
      const url = urlData.publicUrl;
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ lobby_card_image: url })
        .eq("id", profile.id);
      if (dbErr) throw dbErr;
      setCustomImage(url);
      setCropFile(null);
      toast.success("名片图片已更新！");
    } catch (e) {
      console.error("lobby card upload failed:", e);
      toast.error("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!profile?.id) return;
    if (customImage) {
      const oldPath = customImage.split("/profile-backgrounds/")[1];
      if (oldPath) await supabase.storage.from("profile-backgrounds").remove([oldPath]);
    }
    await supabase.from("profiles").update({ lobby_card_image: null }).eq("id", profile.id);
    setCustomImage(null);
    toast.success("已恢复名片原始样式");
  };

  const rankName = LOBBY_RANK_NAMES[profile?.rank_tier] ?? "青铜";

  return (
    <>
    <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)_260px]">
      {/* ===== 左栏：玩家数据 ===== */}
      <div className="order-2 xl:order-1 space-y-4">
        <div data-tour="stats">
          <PlayerStats {...playerData} profileId={profile?.id} onEnergyPurchased={onEnergyPurchased} />
        </div>
      </div>

      {/* ===== 中栏：名片英雄位 + 匹配按钮 ===== */}
      <div className="order-1 xl:order-2 flex flex-col items-center justify-center gap-6 py-2">
        {/* 顶部状态条 */}
        <div className="flex items-center gap-8 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">分区</div>
            <div className="font-tactical font-semibold">{zoneName(Number(grade))}</div>
          </div>
          <div className="relative flex h-14 w-14 items-center justify-center">
            <div className="absolute inset-0 rotate-45 border-2 border-primary/70 bg-secondary/40" />
            <span className="relative font-tactical text-2xl font-bold text-glow-red">{playerData.level}</span>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">段位</div>
            <div className="font-tactical font-semibold">{rankName}</div>
          </div>
        </div>

        <div className="grid w-full max-w-[592px] grid-cols-2 items-start gap-3 sm:gap-4">
          <LobbyPlayerCard profile={profile ?? { username: playerData.username }} image={customImage}
            refreshKey={refreshKey} host={!!party && isHost}>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect} className="hidden" disabled={uploading} />
            <div className="absolute right-2 top-2 z-20 flex gap-1">
              {customImage && <Button variant="secondary" size="icon" title="恢复原始名片" aria-label="恢复原始名片"
                className="h-8 w-8" onClick={handleRemoveImage}><Trash2 /></Button>}
              <Button variant="secondary" size="icon" title="上传自定义名片图片" aria-label="上传自定义名片图片"
                className="h-8 w-8" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              </Button>
            </div>
          </LobbyPlayerCard>
          {teammate && party ? <LobbyPlayerCard profile={teammate} image={teammate.lobby_card_image}
            refreshKey={refreshKey} host={!isHost} status={party.member_id ? "就绪" : "等待接受..."} />
            : <Button variant="outline" aria-label="邀请好友组队" title="邀请好友组队"
              disabled={!profile || !!party} onClick={() => { setShowFriends(true); void partyState.loadFriends(); }}
              className="h-auto w-full aspect-[4/7] border-dashed border-2 bg-secondary/20 text-muted-foreground val-cut">
              {party ? <Loader2 className="!h-10 !w-10 animate-spin" /> : <Plus className="!h-12 !w-12" />}
            </Button>}
        </div>
        <div className="flex w-full max-w-[592px] flex-col items-center gap-3">
          <Button onClick={() => setShowModes(true)} disabled={!canStart || partyState.busy}
            data-tour="levels" className="val-cut h-14 w-72 max-w-full font-tactical text-xl font-bold">
            <Swords className="!h-5 !w-5" /> {party && !isHost ? "等待房主开始" : party && !party.member_id ? "等待好友加入" : "开始游戏"}
          </Button>
          {party && <Button variant="ghost" disabled={partyState.busy || party.status === "queued"}
            onClick={() => void partyState.leave()}><LogOut />{isHost ? "解散队伍" : "离开队伍"}</Button>}
        </div>
      </div>

      {/* ===== 右栏：段位 + 每日任务 + 赛季手册 ===== */}
      <div className="order-3 space-y-4">
        {profile && (
          <RankDisplay tier={profile.rank_tier as any} stars={profile.rank_stars} wins={profile.wins} losses={profile.losses} />
        )}
        <div data-tour="checkin">
          <CheckInCard />
        </div>
        <div data-tour="quests">
          <DailyQuest key={refreshKey} onQuestUpdate={onEnergyPurchased} />
        </div>
        {profile && (
          <button
            onClick={() => onNavigate("seasonpass")}
            className="group relative w-full overflow-hidden border border-border/60 bg-gradient-to-br from-primary/25 via-secondary/40 to-secondary/20 val-cut-sm p-4 text-left transition-all hover:border-primary/60"
          >
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">赛季手册</div>
            <div className="mt-1 font-tactical text-lg font-bold uppercase">S2「远航」</div>
            <div className="mt-1 text-xs text-muted-foreground">升级手册，解锁限定名片与勋章</div>
            <ChevronRight className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-primary transition-transform group-hover:translate-x-1" />
          </button>
        )}
      </div>
    </div>

      {cropFile && (
        <LobbyCardCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onConfirm={uploadCroppedImage}
        />
      )}

      <LobbyFriendPicker open={showFriends} onOpenChange={setShowFriends} grade={grade}
        friends={partyState.friends} loading={partyState.loadingFriends} busy={partyState.busy}
        onRetry={() => void partyState.loadFriends()}
        onInvite={async friend => { if (await partyState.invite(friend)) setShowFriends(false); }} />

      {showModes && (
        <ModeSelect
          grouped={!!party} canStart={canStart}
          onClose={() => setShowModes(false)}
          onRanked={onStartMatch}
          onFree={onFreeMatch}
          on2v2={() => onNavigate("battle2v2-select")}
          onBot={() => onNavigate("bot")}
          onFriends={() => onNavigate("friends")}
          onLevels={() => onNavigate("learn")}
        />
      )}
    </>
  );
};

export default HomeLobby;
