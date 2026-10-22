import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, Ghost, BookOpen, Lock, Users } from "lucide-react";
import boss from "@/assets/team-boss.jpg";
import { Button } from "@/components/ui/button";
import forest from "@/assets/roguelike-forest.jpg";
import { useAuth } from "@/hooks/useAuth";
import { useLobbyParty } from "@/hooks/useLobbyParty";

export default function Entertainment() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { party } = useLobbyParty(profile);
  return <div className="min-h-screen bg-background bg-grid-pattern">
    <header className="border-b border-border"><div className="mx-auto max-w-5xl px-4 py-4"><Button variant="ghost" onClick={() => navigate("/?modes=1")}><ArrowLeft className="h-4 w-4" />匹配大厅</Button></div></header>
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
      <div className="flex items-end justify-between gap-4"><h1 className="text-4xl font-gaming font-bold">娱乐模式</h1><span className="text-sm text-gold">不计段位</span></div>
      <article className="relative overflow-hidden border border-border min-h-[340px]">
        <img src={forest} alt="冒险者与古树守护者" width={1536} height={864} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="relative flex min-h-[340px] flex-col justify-end items-start p-6 sm:p-8 gap-3">
          <span className="text-xs font-bold text-gold">单人 · 常驻</span><h2 className="text-4xl font-gaming font-bold">词汇肉鸽</h2>
          <div className="flex flex-wrap gap-4 text-sm"><span>分岔路线</span><span>三选一技能</span><span>关底 Boss</span><span>8 分钟</span></div>
          <Button variant="gold" size="lg" disabled={!!party} onClick={() => navigate("/roguelike")}>
            {party ? <Lock className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}词汇肉鸽<ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </article>
      <article className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-border bg-card p-6">
        <div className="flex items-start gap-4"><Ghost className="h-10 w-10 text-primary shrink-0" /><div className="space-y-2"><span className="text-xs text-gold">限时 · 10.22–11.22</span><h2 className="font-gaming text-2xl font-bold">万圣节道具赛</h2><div className="flex flex-wrap gap-3 text-sm text-muted-foreground"><span>1v1 / 2v2</span><span>每人 30 题</span><span>8 种道具</span></div></div></div>
        <Button variant="hero" disabled={!!party} onClick={() => navigate("/halloween")}><Ghost className="h-4 w-4" />进入道具赛<ArrowUpRight className="h-4 w-4" /></Button>
      </article>
      <article className="relative overflow-hidden border border-border min-h-[300px]">
        <img src={boss} alt="战队挑战晶角巨兽" loading="lazy" width={1536} height={864} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="relative min-h-[300px] p-6 sm:p-8 flex flex-col items-start justify-end gap-3"><span className="text-xs text-gold font-bold">战队 · 常驻</span><h2 className="font-gaming text-4xl font-bold">战队 Boss</h2><div className="flex flex-wrap gap-4 text-sm"><span>3—5 人</span><span>治疗救援</span><span>合力打断</span></div><Button variant="gold" disabled={!!party} onClick={() => navigate("/team-boss")}><Users className="h-4 w-4" />进入挑战<ArrowUpRight className="h-4 w-4" /></Button></div>
      </article>
      {party && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" />组队中不可选择</div>}
    </main>
  </div>;
}