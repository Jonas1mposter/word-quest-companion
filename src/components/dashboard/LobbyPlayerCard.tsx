import { useEffect, useState, type ReactNode } from "react";
import { Award, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import NameCardFx, { nameCardFxClass, nameCardFxStyle } from "@/components/NameCardFx";
import BadgeIcon from "@/components/ui/badge-icon";
import { getNameCardGradientStyle } from "@/components/profile-card/utils";
import { cn } from "@/lib/utils";

interface EquippedCard { name: string; icon: string | null; rarity: string; background_gradient: string; }
export const LOBBY_RANK_NAMES: Record<string, string> = {
  bronze: "青铜", silver: "白银", gold: "黄金", platinum: "铂金",
  diamond: "钻石", star: "星耀", ace: "王牌", champion: "狄邦巅峰",
};

interface Props {
  profile: { id?: string; username: string; rank_tier?: string; avatar_url?: string | null };
  image?: string | null;
  refreshKey: number;
  host?: boolean;
  status?: string;
  children?: ReactNode;
}

export default function LobbyPlayerCard({ profile, image, refreshKey, host, status = "就绪", children }: Props) {
  const [card, setCard] = useState<EquippedCard | null>(null);
  useEffect(() => {
    let active = true;
    setCard(null);
    if (!profile.id) return;
    supabase.from("user_name_cards").select("name_cards (name, icon, rarity, background_gradient)")
      .eq("profile_id", profile.id).eq("is_equipped", true).maybeSingle().then(({ data }) => {
        if (active) setCard(data?.name_cards ?? null);
      });
    return () => { active = false; };
  }, [profile.id, refreshKey]);
  const background = card ? getNameCardGradientStyle(card.background_gradient) : undefined;
  return (
    <div className={cn("relative w-full aspect-[4/7] overflow-hidden border border-border/60 bg-secondary val-cut shadow-xl",
      card && !image && nameCardFxClass(card.rarity))}
      style={image ? { backgroundImage: `url(${image})`, backgroundSize: "cover", backgroundPosition: "center" }
        : card ? { background, ...nameCardFxStyle(card.rarity) } : undefined}>
      {card && !image && <NameCardFx rarity={card.rarity} background={background} />}
      {!card && !image && <div className="absolute inset-0 flex items-center justify-center">
        {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-20 w-20 rounded-full object-cover" />
          : <Award className="h-16 w-16 text-muted-foreground/30" />}
      </div>}
      {host && <Crown aria-label="房主" className="absolute left-3 top-3 z-10 h-5 w-5 text-gold" />}
      {children}
      <div className="absolute inset-x-0 bottom-0 z-10 border-t border-border/50 bg-background/80 px-3 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-xs text-success"><span className="h-2 w-2 shrink-0 bg-success" />{status}</div>
        <div data-no-translate className="mt-1 break-all font-tactical text-lg font-bold leading-tight text-foreground">{profile.username}</div>
        <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          {card && <BadgeIcon icon={card.icon ?? ""} className="h-3.5 w-3.5 shrink-0 text-gold" />}
          <span className="truncate">{card?.name ?? "未佩戴称号"}</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{LOBBY_RANK_NAMES[profile.rank_tier ?? "bronze"] ?? "青铜"}</div>
      </div>
    </div>
  );
}