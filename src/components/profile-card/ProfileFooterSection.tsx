import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BadgeIcon } from "@/components/ui/badge-icon";
import { Award, Pencil, X, Check, Shield, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NameCardData, rarityColors, rarityLabels, getUnlockCondition } from "./constants";
import { getNameCardGradientStyle } from "./utils";

interface Props {
  username: string;
  equippedNameCard: NameCardData | null;
  userNameCards: NameCardData[];
  allNameCards: NameCardData[];
  editUsername: string;
  setEditUsername: (v: string) => void;
  profileEditOpen: boolean;
  setProfileEditOpen: (v: boolean) => void;
  savingProfile: boolean;
  onSaveProfile: () => void;
  onEquipNameCard: (card: NameCardData) => void;
  onUnequipNameCard: () => void;
}

export const ProfileFooterSection = ({
  username, equippedNameCard, userNameCards, allNameCards,
  editUsername, setEditUsername, profileEditOpen, setProfileEditOpen,
  savingProfile, onSaveProfile, onEquipNameCard, onUnequipNameCard,
}: Props) => {
  const [nameCardDialogOpen, setNameCardDialogOpen] = useState(false);

  return (
    <div className="border-t border-border/50">
      <div className="flex">
        <Dialog open={profileEditOpen} onOpenChange={(open) => {
          setProfileEditOpen(open);
          if (open) setEditUsername(username);
        }}>
          <DialogTrigger asChild>
            <div className="flex-1 p-4 flex items-center gap-2 cursor-pointer hover:bg-secondary/30 transition-all">
              <div className="font-gaming text-lg">{username}</div>
              <Pencil className="w-4 h-4 text-muted-foreground" />
            </div>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>编辑个人信息</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">用户名</Label>
                <Input
                  id="username"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="输入用户名"
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">最多20个字符</p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setProfileEditOpen(false)}>取消</Button>
                <Button onClick={onSaveProfile} disabled={savingProfile}>
                  {savingProfile ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />保存中...</>
                  ) : "保存"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={nameCardDialogOpen} onOpenChange={setNameCardDialogOpen}>
          <DialogTrigger asChild>
            <div
              className={cn(
                "flex-1 p-4 cursor-pointer border-l border-border/50 hover:bg-secondary/30 transition-all",
                equippedNameCard && "relative overflow-hidden"
              )}
              style={equippedNameCard ? {
                background: getNameCardGradientStyle(equippedNameCard.background_gradient),
              } : undefined}
            >
              <div className="flex items-center gap-2 relative z-10">
                {equippedNameCard ? (
                  <>
                    <BadgeIcon icon={equippedNameCard.icon || "Award"} className="w-6 h-6 text-white" />
                    <div>
                      <div className="text-sm font-gaming text-white">{equippedNameCard.name}</div>
                      {equippedNameCard.rank_position && (
                        <div className="text-xs text-white/80">#{equippedNameCard.rank_position}</div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <Award className="w-5 h-5 text-primary" />
                    <div>
                      <div className="text-xs text-muted-foreground">名片区</div>
                      <div className="text-sm text-muted-foreground">可佩戴自己获得的名片</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>选择名片</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {equippedNameCard && (
                <Button variant="outline" className="w-full" onClick={() => { onUnequipNameCard(); setNameCardDialogOpen(false); }}>
                  <X className="w-4 h-4 mr-2" />卸下当前名片
                </Button>
              )}

              {userNameCards.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground font-medium">已获得 ({userNameCards.length})</div>
                  {userNameCards.map((card) => {
                    const isCustomGradient = card.background_gradient?.startsWith("linear-gradient");
                    return (
                      <Card
                        key={card.id}
                        className={cn(
                          "cursor-pointer transition-all hover:scale-[1.02]",
                          !isCustomGradient && `bg-gradient-to-r ${card.background_gradient}`,
                          card.is_equipped && "ring-2 ring-white"
                        )}
                        style={isCustomGradient ? { background: card.background_gradient } : undefined}
                        onClick={() => { onEquipNameCard(card); setNameCardDialogOpen(false); }}
                      >
                        <CardContent className="p-4 flex items-center gap-3 text-white">
                          <BadgeIcon icon={card.icon || "Award"} className="w-8 h-8" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-gaming text-lg">{card.name}</span>
                              <Badge variant="outline" className={cn("text-xs border-white/30", rarityColors[card.rarity])}>
                                {rarityLabels[card.rarity] || card.rarity}
                              </Badge>
                            </div>
                            <div className="text-sm opacity-80">{card.description}</div>
                          </div>
                          {card.rank_position && <Badge variant="secondary">第{card.rank_position}名</Badge>}
                          {card.is_equipped && <Check className="w-6 h-6" />}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {allNameCards.filter((c) => !c.is_owned).length > 0 && (
                <div className="space-y-2 mt-4">
                  <div className="text-sm text-muted-foreground font-medium">未解锁</div>
                  {allNameCards.filter((c) => !c.is_owned).map((card) => {
                    const isCustomGradient = card.background_gradient?.startsWith("linear-gradient");
                    return (
                      <Card
                        key={card.id}
                        className="transition-all opacity-60 grayscale relative overflow-hidden"
                        style={isCustomGradient ? { background: card.background_gradient } : undefined}
                      >
                        {!isCustomGradient && (
                          <div className={cn("absolute inset-0 bg-gradient-to-r", card.background_gradient)} />
                        )}
                        <CardContent className="p-4 flex items-center gap-3 text-white relative z-10">
                          <BadgeIcon icon={card.icon || "Award"} className="w-8 h-8 opacity-50" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-gaming text-lg">{card.name}</span>
                              <Badge variant="outline" className={cn("text-xs border-white/30", rarityColors[card.rarity])}>
                                {rarityLabels[card.rarity] || card.rarity}
                              </Badge>
                            </div>
                            <div className="text-sm opacity-60 flex items-center gap-1">
                              <Shield className="w-3 h-3" />
                              {getUnlockCondition(card)}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {allNameCards.length === 0 && (
                <div className="text-center text-muted-foreground py-8">加载名片中...</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};
