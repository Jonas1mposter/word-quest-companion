import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { backgroundOptions, BadgeData, NameCardData, RankTier } from "./profile-card/constants";
import { useProfileCardData } from "./profile-card/useProfileCardData";
import { BackgroundPicker } from "./profile-card/BackgroundPicker";
import { BadgeSlots } from "./profile-card/BadgeSlots";
import { RankProgressSection } from "./profile-card/RankProgressSection";
import { BestRecordsSection } from "./profile-card/BestRecordsSection";
import { ProfileFooterSection } from "./profile-card/ProfileFooterSection";

const ProfileCard = () => {
  const { profile, user, refreshProfile } = useAuth();
  const {
    userBadges, equippedBadges,
    allNameCards, userNameCards, equippedNameCard,
    bestRecords,
    refetchBadges, refetchNameCards,
  } = useProfileCardData(profile);

  const [bgDialogOpen, setBgDialogOpen] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [backgroundType, setBackgroundType] = useState<string>("gradient");
  const [backgroundValue, setBackgroundValue] = useState<string>("default");

  useEffect(() => {
    if (profile) {
      setEditUsername(profile.username);
      if ((profile as any).background_type) {
        setBackgroundType((profile as any).background_type);
        setBackgroundValue((profile as any).background_value || "default");
      }
    }
  }, [profile?.id]);

  if (!profile) return null;

  // === Background handlers ===
  const handleSelectGradient = async (bgId: string) => {
    setBackgroundType("gradient");
    setBackgroundValue(bgId);
    setBgDialogOpen(false);
    await supabase.from("profiles")
      .update({ background_type: "gradient", background_value: bgId })
      .eq("id", profile.id);
    const bg = backgroundOptions.find((b) => b.id === bgId);
    toast.success(`已切换为${bg?.name || "默认"}背景`);
  };

  const handleUploadBackground = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !user) return;
    const file = event.target.files[0];
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    const allowed = ["jpg", "jpeg", "png", "gif", "webp"];
    if (!fileExt || !allowed.includes(fileExt)) {
      toast.error("请上传 JPG、PNG、GIF 或 WebP 格式的图片");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("图片大小不能超过 5MB");
      return;
    }
    setUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      if (backgroundType === "image" && backgroundValue) {
        const oldPath = backgroundValue.split("/profile-backgrounds/")[1];
        if (oldPath) await supabase.storage.from("profile-backgrounds").remove([oldPath]);
      }
      const uploadResult = await supabase.storage
        .from("profile-backgrounds")
        .upload(fileName, file, { upsert: true }) as any;
      if (uploadResult?.error) throw uploadResult.error;
      const { data: urlData } = supabase.storage.from("profile-backgrounds").getPublicUrl(fileName);
      const newBgUrl = urlData.publicUrl;
      await supabase.from("profiles")
        .update({ background_type: "image", background_value: newBgUrl })
        .eq("id", profile.id);
      setBackgroundType("image");
      setBackgroundValue(newBgUrl);
      setBgDialogOpen(false);
      toast.success("背景上传成功！");
    } catch (error: any) {
      console.error("Error uploading background:", error);
      toast.error("上传失败，请重试");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveCustomBackground = async () => {
    if (backgroundType === "image" && backgroundValue) {
      const oldPath = backgroundValue.split("/profile-backgrounds/")[1];
      if (oldPath) await supabase.storage.from("profile-backgrounds").remove([oldPath]);
    }
    await supabase.from("profiles")
      .update({ background_type: "gradient", background_value: "default" })
      .eq("id", profile.id);
    setBackgroundType("gradient");
    setBackgroundValue("default");
    toast.success("已恢复默认背景");
  };

  // === Badge handlers ===
  const handleEquipBadge = async (badge: BadgeData, slot: number) => {
    const currentBadge = equippedBadges[slot];
    if (currentBadge) {
      await supabase.from("user_badges")
        .update({ equipped_slot: null })
        .eq("profile_id", profile.id).eq("badge_id", currentBadge.id);
    }
    const existingSlot = equippedBadges.findIndex((b) => b?.id === badge.id);
    if (existingSlot !== -1 && existingSlot !== slot) {
      await supabase.from("user_badges")
        .update({ equipped_slot: null })
        .eq("profile_id", profile.id).eq("badge_id", badge.id);
    }
    await supabase.from("user_badges")
      .update({ equipped_slot: slot })
      .eq("profile_id", profile.id).eq("badge_id", badge.id);
    refetchBadges();
    toast.success("勋章已装备");
  };

  const handleUnequipBadge = async (slot: number) => {
    const badge = equippedBadges[slot];
    if (badge) {
      await supabase.from("user_badges")
        .update({ equipped_slot: null })
        .eq("profile_id", profile.id).eq("badge_id", badge.id);
      refetchBadges();
      toast.success("勋章已卸下");
    }
  };

  // === Name card handlers ===
  const handleEquipNameCard = async (card: NameCardData) => {
    await supabase.from("user_name_cards")
      .update({ is_equipped: false }).eq("profile_id", profile.id);
    await supabase.from("user_name_cards")
      .update({ is_equipped: true })
      .eq("profile_id", profile.id).eq("name_card_id", card.id);
    refetchNameCards();
    toast.success("名片已装备");
  };

  const handleUnequipNameCard = async () => {
    await supabase.from("user_name_cards")
      .update({ is_equipped: false }).eq("profile_id", profile.id);
    refetchNameCards();
    toast.success("名片已卸下");
  };

  // === Profile edit ===
  const handleSaveProfile = async () => {
    if (!editUsername.trim()) { toast.error("用户名不能为空"); return; }
    if (editUsername.trim().length > 20) { toast.error("用户名不能超过20个字符"); return; }
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles")
        .update({ username: editUsername.trim() }).eq("id", profile.id);
      if (error) throw error;
      await refreshProfile();
      setProfileEditOpen(false);
      toast.success("个人信息已更新");
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("更新失败，请重试");
    } finally {
      setSavingProfile(false);
    }
  };

  const backgroundStyle = backgroundType === "image" && backgroundValue
    ? { backgroundImage: `url(${backgroundValue})`, backgroundSize: "cover", backgroundPosition: "center" }
    : {};

  const gradientClass = backgroundType === "gradient"
    ? backgroundOptions.find((b) => b.id === backgroundValue)?.gradient || backgroundOptions[0].gradient
    : "";

  const rankTier = (profile.rank_tier || "bronze") as RankTier;

  return (
    <Card variant="gaming" className="overflow-hidden">
      <div
        className={cn(
          "h-48 relative flex items-center justify-center",
          backgroundType === "gradient" && `bg-gradient-to-br ${gradientClass}`
        )}
        style={backgroundStyle}
      >
        <BackgroundPicker
          open={bgDialogOpen}
          onOpenChange={setBgDialogOpen}
          backgroundType={backgroundType}
          backgroundValue={backgroundValue}
          uploading={uploading}
          onSelectGradient={handleSelectGradient}
          onUpload={handleUploadBackground}
          onRemoveCustom={handleRemoveCustomBackground}
        />
        <BadgeSlots
          equippedBadges={equippedBadges}
          userBadges={userBadges}
          onEquip={handleEquipBadge}
          onUnequip={handleUnequipBadge}
        />
      </div>

      <div className="h-12" />

      {profile.rank_tier && (
        <RankProgressSection rankTier={rankTier} rankStars={profile.rank_stars || 0} />
      )}

      <BestRecordsSection bestRecords={bestRecords} />

      <ProfileFooterSection
        username={profile.username}
        equippedNameCard={equippedNameCard}
        userNameCards={userNameCards}
        allNameCards={allNameCards}
        editUsername={editUsername}
        setEditUsername={setEditUsername}
        profileEditOpen={profileEditOpen}
        setProfileEditOpen={setProfileEditOpen}
        savingProfile={savingProfile}
        onSaveProfile={handleSaveProfile}
        onEquipNameCard={handleEquipNameCard}
        onUnequipNameCard={handleUnequipNameCard}
      />
    </Card>
  );
};

export default ProfileCard;
