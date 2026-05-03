import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BadgeIcon } from "@/components/ui/badge-icon";
import { Award, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BadgeData } from "./constants";
import { getRarityBorderStyle, getRarityColor } from "./utils";

interface Props {
  equippedBadges: (BadgeData | null)[];
  userBadges: BadgeData[];
  onEquip: (badge: BadgeData, slot: number) => void;
  onUnequip: (slot: number) => void;
}

export const BadgeSlots = ({ equippedBadges, userBadges, onEquip, onUnequip }: Props) => {
  const [open, setOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(0);

  return (
    <div className="absolute bottom-0 left-0 right-0 translate-y-1/2">
      <div className="flex justify-center gap-4">
        {[0, 1, 2].map((slot) => {
          const badge = equippedBadges[slot];
          return (
            <Dialog
              key={slot}
              open={open && selectedSlot === slot}
              onOpenChange={(o) => {
                setOpen(o);
                if (o) setSelectedSlot(slot);
              }}
            >
              <DialogTrigger asChild>
                <button
                  className={cn(
                    "w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all shadow-lg overflow-hidden",
                    !badge && "border-dashed border-muted-foreground/50 bg-background/90 hover:border-primary/50"
                  )}
                  style={badge ? { ...getRarityBorderStyle(badge.rarity), borderWidth: "2px" } : undefined}
                >
                  {badge ? (
                    <BadgeIcon icon={badge.icon} className="w-7 h-7 text-white drop-shadow-md" />
                  ) : (
                    <Award className="w-5 h-5 text-muted-foreground/50" />
                  )}
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{badge ? "更换勋章" : "选择勋章"} - 槽位 {slot + 1}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 max-h-[60vh] overflow-y-auto">
                  {badge && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        onUnequip(slot);
                        setOpen(false);
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />卸下当前勋章
                    </Button>
                  )}
                  {userBadges.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      暂无勋章，完成成就可获得勋章
                    </div>
                  ) : (
                    userBadges
                      .filter((b) => !equippedBadges.some((e) => e?.id === b.id) || b.id === badge?.id)
                      .map((b) => (
                        <Card
                          key={b.id}
                          className={cn(
                            "cursor-pointer transition-all hover:bg-secondary/50",
                            b.id === badge?.id && "ring-2 ring-primary"
                          )}
                          onClick={() => {
                            onEquip(b, slot);
                            setOpen(false);
                          }}
                        >
                          <CardContent className="p-4 flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                              <BadgeIcon icon={b.icon} className={cn("w-6 h-6", getRarityColor(b.rarity))} />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold">{b.name}</div>
                              <div className="text-sm text-muted-foreground">{b.description}</div>
                            </div>
                            <Badge variant="outline" className={getRarityColor(b.rarity)}>
                              {b.rarity}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))
                  )}
                </div>
              </DialogContent>
            </Dialog>
          );
        })}
      </div>
    </div>
  );
};
