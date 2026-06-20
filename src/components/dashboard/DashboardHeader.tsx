import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SettingsSheet } from "@/components/SettingsSheet";
import { Crown, GraduationCap, LogOut, ShoppingBag, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

const logoDashboard = "/placeholder.svg";

interface DashboardHeaderProps {
  grade: 7 | 8;
  className?: string | null;
  user: any;
  isAdmin: boolean;
  onSignOut: () => void;
}

const DashboardHeader = ({ grade, className, user, isAdmin, onSignOut }: DashboardHeaderProps) => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img alt="狄邦单词通" className="w-10 h-10 rounded-lg shadow-md" src={logoDashboard} />
            <div>
              <h1 className="font-gaming text-xl text-glow-purple">狄邦单词通</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={grade === 7 ? "outline" : "champion"} className="text-xs flex items-center gap-1">
                  <GraduationCap className="w-3 h-3" />
                  {grade === 7 ? "七" : "八"}年级专区
                </Badge>
                {className && <Badge variant="secondary" className="text-xs">{className}班</Badge>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!user && (
              <Button variant="hero" size="sm" onClick={() => navigate("/auth")}>
                <User className="w-4 h-4 mr-2" />登录
              </Button>
            )}
            {user && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate('/shop')}
                  className="border-amber-400/60 text-amber-400 hover:bg-amber-400/10">
                  <ShoppingBag className="w-4 h-4 mr-2" />商城
                </Button>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => navigate('/admin')}
                    className="border-accent text-accent hover:bg-accent hover:text-accent-foreground">
                    <Crown className="w-4 h-4 mr-2" />后台
                  </Button>
                )}
                <SettingsSheet />
                <Button variant="ghost" size="icon" onClick={onSignOut}>
                  <LogOut className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
