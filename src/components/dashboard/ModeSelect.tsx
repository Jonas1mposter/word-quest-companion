import { X, Trophy, Globe, Users, Bot, UserPlus, BookOpen, Lock, Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canSelectPartyMode, type PartyGameMode } from "@/lib/partyRules";
import { cn } from "@/lib/utils";

interface ModeSelectProps {
  grouped?: boolean;
  canStart?: boolean;
  onClose: () => void;
  onRanked: () => void;
  onFree: () => void;
  on2v2: () => void;
  onBot: () => void;
  onFriends: () => void;
  onLevels: () => void;
  onEntertainment: () => void;
}

interface ModeDef {
  id: PartyGameMode;
  name: string;
  description: string;
  icon: typeof Trophy;
  art: string;
  badge?: string;
  onClick: () => void;
}

const ModeSelect = ({ grouped = false, canStart = true, onClose, onRanked, onFree, on2v2, onBot, onFriends, onLevels, onEntertainment }: ModeSelectProps) => {
  const modes: ModeDef[] = [
    { id: "ranked", name: "排位赛", description: "冲段位 · 青铜到狄邦巅峰", icon: Trophy, art: "from-primary/80 via-secondary to-background", badge: "竞技", onClick: onRanked },
    { id: "levels", name: "闯关模式", description: "教材同步 · 按单元学单词", icon: BookOpen, art: "from-neon-blue/70 via-secondary to-background", badge: "主线", onClick: onLevels },
    { id: "free", name: "自由服", description: "跨年级自由匹配 · 不计段位", icon: Globe, art: "from-neon-cyan/70 via-secondary to-background", onClick: onFree },
    { id: "2v2", name: "2v2 组队", description: "四人同场 · 组队切磋", icon: Users, art: "from-accent/70 via-secondary to-background", onClick: on2v2 },
    { id: "bot", name: "人机对战", description: "三档难度 · 随时开练", icon: Bot, art: "from-success/70 via-secondary to-background", onClick: onBot },
    { id: "friends", name: "好友对战", description: "邀请好友 · 实时 1v1", icon: UserPlus, art: "from-gold/70 via-secondary to-background", onClick: onFriends },
    { id: "entertainment", name: "娱乐模式", description: "万圣节道具赛 · 词汇肉鸽", icon: Gamepad2, art: "from-success/70 via-secondary to-background", badge: "新玩法", onClick: onEntertainment },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm bg-grid-pattern flex flex-col overflow-y-auto">
      <Button variant="ghost"
        onClick={onClose}
        aria-label="关闭"
        className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary transition-colors val-cut-sm"
      >
        <X className="w-5 h-5" />
      </Button>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-10 w-full max-w-5xl mx-auto">
        <div className="flex items-center gap-4 w-full max-w-xl mb-8">
          <div className="flex-1 h-px bg-border" />
          <h1 className="font-tactical text-2xl md:text-3xl font-bold uppercase tracking-[0.2em] text-center">
            选择匹配队列
          </h1>
          <div className="flex-1 h-px bg-border" />
        </div>

        <div className="grid gap-3 w-full grid-cols-2 md:grid-cols-3">
          {modes.map((mode) => {
            const enabled = canStart && canSelectPartyMode(mode.id, grouped);
            const Icon = mode.icon;
            return (
              <Button variant="ghost"
                key={mode.name}
                disabled={!enabled}
                title={enabled ? mode.name : "组队中不可选择"}
                onClick={() => { if (enabled) mode.onClick(); }}
                className="group relative h-36 md:h-48 block whitespace-normal rounded-none p-0 overflow-hidden text-left border border-border/60 transition-all duration-200 hover:border-primary hover:shadow-[0_0_24px_-4px_hsl(var(--primary)/0.6)]"
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br", mode.art)} />
                {!enabled && <Lock className="absolute top-3 left-3 z-10 h-4 w-4 text-muted-foreground" />}
                <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/30 to-transparent" />
                <Icon className="absolute -right-4 -bottom-4 w-28 h-28 text-foreground/10 group-hover:text-foreground/20 transition-colors" />

                {mode.badge && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-primary text-primary-foreground text-[10px] font-bold tracking-wider val-cut-sm">
                    {mode.badge}
                  </span>
                )}

                {/* hover corner tick */}
                <div className="absolute top-0 left-0 w-0 h-0 border-t-[26px] border-l-[26px] border-t-primary border-l-primary border-r-transparent border-b-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <span className="font-tactical font-bold text-lg uppercase tracking-wider">
                      {mode.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                </div>
              </Button>
            );
          })}
        </div>

        <p className="mt-6 text-xs text-muted-foreground tracking-wider">
          选择队列后开始匹配对手
        </p>
      </div>
    </div>
  );
};

export default ModeSelect;
