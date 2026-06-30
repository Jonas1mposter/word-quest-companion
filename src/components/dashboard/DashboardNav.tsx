import { Button } from "@/components/ui/button";
import {
  Sparkles, BookOpen, BookX, Swords, Globe, Target, Book, Bot,
  Users, Shield, History, Trophy, User, LucideIcon,
} from "lucide-react";

export type DashboardView =
  | "home" | "learn" | "mathlearn" | "sciencelearn"
  | "battle" | "battle-select" | "battle2v2" | "battle2v2-select"
  | "freematch" | "freematch-select" | "bot"
  | "leaderboard" | "profile" | "friends" | "wrongbook"
  | "challenge" | "seasonpass" | "spectate" | "history" | "team";

interface Tab { id: DashboardView; label: string; icon: LucideIcon; }

const TABS: Tab[] = [
  { id: "home", label: "主页", icon: Sparkles },
  { id: "learn", label: "闯关", icon: BookOpen },
  { id: "wrongbook", label: "错题本", icon: BookX },
  { id: "battle-select", label: "排位赛", icon: Swords },
  { id: "freematch-select", label: "自由服", icon: Globe },
  { id: "bot", label: "人机", icon: Bot },
  { id: "challenge", label: "挑战赛", icon: Target },
  { id: "seasonpass", label: "手册", icon: Book },
  { id: "friends", label: "好友", icon: Users },
  { id: "team", label: "战队", icon: Shield },
  { id: "history", label: "战绩", icon: History },
  { id: "leaderboard", label: "排行榜", icon: Trophy },
  { id: "profile", label: "个人", icon: User },
];

interface DashboardNavProps {
  activeView: DashboardView;
  onSelect: (view: DashboardView) => void;
}

const DashboardNav = ({ activeView, onSelect }: DashboardNavProps) => (
  <nav className="sticky top-[73px] z-40 bg-background/60 backdrop-blur-lg border-b border-border/30">
    <div className="container mx-auto px-2">
      <div className="flex gap-0.5 py-1.5 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          const isActive =
            activeView === tab.id ||
            (tab.id === "battle-select" && activeView === "battle") ||
            (tab.id === "freematch-select" && activeView === "freematch");
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "ghost"}
              size="sm"
              onClick={() => onSelect(tab.id)}
              className="px-2 py-1 h-8 text-xs whitespace-nowrap"
            >
              <tab.icon className="w-3.5 h-3.5 mr-1" />
              {tab.label}
            </Button>
          );
        })}
      </div>
    </div>
  </nav>
);

export default DashboardNav;
