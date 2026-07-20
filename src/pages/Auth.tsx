import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Auth = () => {
  const [oauthLoading, setOauthLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const navigate = useNavigate();

  const handleMicrosoftLogin = async () => {
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'azure',
        options: {
          redirectTo: window.location.origin + '/callback',
          scopes: 'email profile openid GroupMember.Read.All',
        },
      });
      if (error) toast.error(error.message || "微软登录失败");
    } catch (err: any) {
      toast.error(err.message || "微软登录失败");
    } finally {
      setOauthLoading(false);
    }
  };

  const handleEmailAuth = async (mode: "signup" | "signin") => {
    if (!email || !password) {
      toast.error("请输入邮箱和密码");
      return;
    }
    if (password.length < 6) {
      toast.error("密码至少 6 位");
      return;
    }
    setEmailLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + '/callback' },
        });
        if (error) {
          if (error.message?.toLowerCase().includes("already")) {
            // 已注册则直接登录
            const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
            if (signInErr) { toast.error(signInErr.message); return; }
          } else {
            toast.error(error.message);
            return;
          }
        }
        toast.success("注册成功");
        navigate("/");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { toast.error(error.message); return; }
        toast.success("登录成功");
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "操作失败");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center p-6">
      <Card className="w-full max-w-md card-glow">
        <CardHeader className="text-center">
          <CardTitle className="font-gaming text-2xl text-glow-purple">狄邦单词通</CardTitle>
          <p className="text-muted-foreground text-sm mt-2">选择登录方式</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-3 h-12 border-border hover:bg-accent text-base"
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">临时通道</span>
            </div>
          </div>

          <Tabs defaultValue="signup" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signup">注册</TabsTrigger>
              <TabsTrigger value="signin">登录</TabsTrigger>
            </TabsList>
            {(["signup", "signin"] as const).map((mode) => (
              <TabsContent key={mode} value={mode} className="space-y-3 pt-3">
                <div className="space-y-1">
                  <Label htmlFor={`email-${mode}`}>邮箱</Label>
                  <Input
                    id={`email-${mode}`}
                    type="email"
                    placeholder="你的邮箱（可用临时邮箱）"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`pw-${mode}`}>密码</Label>
                  <Input
                    id={`pw-${mode}`}
                    type="password"
                    placeholder="至少 6 位"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  />
                </div>
                <Button
                  type="button"
                  className="w-full h-11"
                  onClick={() => handleEmailAuth(mode)}
                  disabled={emailLoading}
                >
                  {emailLoading ? "处理中..." : mode === "signup" ? "免验证注册并进入" : "登录"}
                </Button>
                {mode === "signup" && (
                  <p className="text-xs text-muted-foreground text-center">
                    临时通道无需邮箱验证，注册后立即登录
                  </p>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
