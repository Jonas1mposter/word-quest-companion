import { Button } from "@/components/ui/button";
import { ChevronLeft, User, LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LoginRequiredProps {
  Icon: LucideIcon;
  iconClassName?: string;
  title: string;
  subtitle: string;
  onBack: () => void;
}

const LoginRequired = ({ Icon, iconClassName, title, subtitle, onBack }: LoginRequiredProps) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center p-6">
      <div className="text-center">
        <Icon className={cn("w-16 h-16 mx-auto mb-4", iconClassName ?? "text-primary")} />
        <h2 className="font-gaming text-2xl mb-4">{title}</h2>
        <p className="text-muted-foreground mb-6">{subtitle}</p>
        <div className="flex gap-4 justify-center">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />返回
          </Button>
          <Button variant="hero" onClick={() => navigate("/auth")}>
            <User className="w-4 h-4 mr-2" />登录 / 注册
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LoginRequired;
