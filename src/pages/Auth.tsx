import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const ALLOWED_EMAIL_DOMAIN = "nkcswx.cn";

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [oauthLoading, setOauthLoading] = useState(false);

  const handleMicrosoftLogin = async () => {
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: window.location.origin,
          scopes: 'email profile openid',
        },
      });
      if (error) {
        toast.error(error.message || "微软登录失败");
      }
    } catch (err: any) {
      toast.error(err.message || "微软登录失败");
    } finally {
      setOauthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // 注册时验证邮箱域名
    if (!isLogin && !email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
      toast.error(`仅允许 @${ALLOWED_EMAIL_DOMAIN} 学校邮箱注册`);
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("登录成功！");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("注册成功！");
      }
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center p-6">
      <Card className="w-full max-w-md card-glow">
        <CardHeader className="text-center">
          <CardTitle className="font-gaming text-2xl text-glow-purple">
            狄邦单词通
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-2">
            {isLogin ? "登录你的账号" : "创建新账号"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            (本地模式 - 数据保存在浏览器中)
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-3 h-11 border-border hover:bg-accent"
            onClick={handleMicrosoftLogin}
            disabled={oauthLoading}
          >
            <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#F25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
              <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
            </svg>
            {oauthLoading ? "正在跳转..." : "使用微软账号登录"}
          </Button>

          <div className="flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">或</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">学校邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="你的学号@nkcswx.cn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {!isLogin && (
                <p className="text-xs text-muted-foreground">仅支持 @nkcswx.cn 学校邮箱注册</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={3}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "处理中..." : isLogin ? "登录" : "注册"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline"
            >
              {isLogin ? "没有账号？点击注册" : "已有账号？点击登录"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
