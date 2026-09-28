import {
  Sparkles, BookX, Target, Book,
  Shield, History, Trophy, User, LucideIcon,
} from "lucide-react";

export type DashboardView =
  | "home" | "learn" | "mathlearn" | "sciencelearn" | "hslearn"
  | "battle" | "battle-select" | "battle2v2" | "battle2v2-select" | "battle2v2-practice"
  | "freematch" | "freematch-select" | "bot"
  | "leaderboard" | "profile" | "friends" | "wrongbook"
  | "challenge" | "seasonpass" | "spectate" | "history" | "team";

interface Tab { id: DashboardView; label: string; icon: LucideIcon; }

const TABS: Tab[] = [
  { id: "home", label: "主页", icon: Sparkles },
  { id: "wrongbook", label: "错题本", icon: BookX },
  { id: "challenge", label: "挑战赛", icon: Target },
  { id: "seasonpass", label: "手册", icon: Book },
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
  <nav className="sticky top-[70px] z-40 bg-secondary/40 backdrop-blur-lg border-b border-border/40">
    <div className="container mx-auto px-2">
      <div className="flex gap-1 py-1.5 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => {
          const isActive =
            activeView === tab.id ||
            (tab.id === "battle-select" && activeView === "battle") ||
            (tab.id === "battle2v2-select" && activeView === "battle2v2") ||
            (tab.id === "freematch-select" && activeView === "freematch");
          return (
            <button
              key={tab.id}
              data-tour={`nav-${tab.id}`}
              onClick={() => onSelect(tab.id)}
              className={`val-cut-tab px-3 h-8 text-xs whitespace-nowrap font-tactical font-semibold uppercase flex items-center transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5 mr-1" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  </nav>
);

export default DashboardNav;
