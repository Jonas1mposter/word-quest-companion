import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const Auth = () => {
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

  return (
    <div className="min-h-screen bg-background bg-grid-pattern flex items-center justify-center p-6">
      <Card className="w-full max-w-md card-glow">
        <CardHeader className="text-center">
          <CardTitle className="font-gaming text-2xl text-glow-purple">
            狄邦单词通
          </CardTitle>
          <p className="text-muted-foreground text-sm mt-2">
            使用学校微软账号登录
          </p>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
