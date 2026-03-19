import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-background bg-grid-pattern">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-gaming text-xl text-glow-purple">狄邦单词通</h1>
              <p className="text-sm text-muted-foreground">{profile.grade}年级 · Lv.{profile.level}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">{profile.username}</span>
              <button onClick={() => { import("@/hooks/useAuth").then(m => {}); }} className="text-sm text-muted-foreground hover:text-foreground">
                退出
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="p-8 rounded-2xl bg-card border border-border/50 card-glow">
            <h2 className="font-gaming text-2xl mb-4 text-glow-purple">欢迎回来, {profile.username}!</h2>
            <p className="text-muted-foreground mb-6">Word Quest 已成功迁移到本地模式。所有数据保存在浏览器 localStorage 中。</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
                <p className="font-gaming text-2xl text-primary">{profile.level}</p>
                <p className="text-xs text-muted-foreground">等级</p>
              </div>
              <div className="p-4 rounded-xl bg-success/10 border border-success/20">
                <p className="font-gaming text-2xl text-success">{profile.coins}</p>
                <p className="text-xs text-muted-foreground">狄邦豆</p>
              </div>
              <div className="p-4 rounded-xl bg-accent/10 border border-accent/20">
                <p className="font-gaming text-2xl text-accent">{profile.energy}/{profile.max_energy}</p>
                <p className="text-xs text-muted-foreground">能量</p>
              </div>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            ⚠️ 注意：多人对战、好友、排行榜等联网功能在本地模式下不可用。<br/>
            单词学习、错题本等核心功能需要导入单词数据后才能使用。
          </p>
        </div>
      </main>
    </div>
  );
};

export default Index;
