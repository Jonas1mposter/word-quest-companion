import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Printer,
  Crown,
  Medal,
  Trophy,
  Coins,
  Swords,
  Shield,
  Sparkles,
  Flag,
  Users,
  Target,
  Clock,
  AlertTriangle,
} from "lucide-react";

const REWARD_TIERS = [2000, 1000, 500, 400, 300, 250, 200, 150, 100, 100];

const SeasonManual = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      {/* 顶部控制栏 */}
      <div className="print:hidden sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> 返回
          </Button>
          <div className="text-sm text-muted-foreground hidden sm:block">
            狄邦战队挑战赛 · 赛季手册
          </div>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> 导出 PDF
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 print:py-4 space-y-8">
        {/* 封面 */}
        <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-purple-500/10 to-amber-500/10 p-8 sm:p-12 text-center">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative">
            <Badge className="mb-4 bg-amber-500/20 text-amber-200 border-amber-500/50 hover:bg-amber-500/30">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> SEASON 01
            </Badge>
            <h1 className="text-4xl sm:text-6xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent tracking-tight">
              第一赛季：起源
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              战队挑战赛正式开启。集结队友、登上巅峰、瓜分百万狄邦豆，
              <br className="hidden sm:block" />
              在起源之季写下属于你们战队的第一页传奇。
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                <Clock className="w-3.5 h-3.5" /> 持续 14 天
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                <Swords className="w-3.5 h-3.5" /> 排位胜场计分
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                <Coins className="w-3.5 h-3.5 text-amber-400" /> 全员瓜分奖励
              </Badge>
            </div>
          </div>
        </section>

        {/* 赛季概览 */}
        <section className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Flag,
              title: "赛季主题",
              text: "起源 · Origins —— 战队体系首航，开荒者将获得专属荣誉记录。",
            },
            {
              icon: Clock,
              title: "赛季周期",
              text: "为期 14 天，结束后由管理员统一结算并发放奖励。",
            },
            {
              icon: Target,
              title: "胜负规则",
              text: "排位赛每胜一场，所在战队 +1 分（自由对战不计入）。",
            },
          ].map(({ icon: Icon, title, text }) => (
            <Card key={title} className="border-primary/20 bg-card/60 backdrop-blur">
              <CardHeader className="pb-2">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center mb-2">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-base">{title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground leading-relaxed">
                {text}
              </CardContent>
            </Card>
          ))}
        </section>

        {/* 奖励档位 */}
        <section>
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-400" /> 奖励档位
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                赛季结算后，按战队总积分排名向<strong className="text-foreground">每位成员</strong>发放狄邦豆。
              </p>
            </div>
            <Badge className="bg-amber-500/20 text-amber-200 border-amber-500/50">
              共 10 档
            </Badge>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {REWARD_TIERS.map((coins, i) => {
              const rank = i + 1;
              const isGold = rank === 1;
              const isSilver = rank === 2;
              const isBronze = rank === 3;
              const accent = isGold
                ? "from-yellow-500/30 to-amber-500/5 border-yellow-500/60"
                : isSilver
                ? "from-slate-300/30 to-slate-100/5 border-slate-300/60"
                : isBronze
                ? "from-orange-500/30 to-orange-300/5 border-orange-500/60"
                : "from-muted/30 to-transparent border-border";
              const Icon = isGold ? Crown : isSilver || isBronze ? Medal : Shield;
              return (
                <div
                  key={i}
                  className={`relative overflow-hidden rounded-xl border bg-gradient-to-r ${accent} p-4 flex items-center justify-between`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-lg bg-background/60 border border-border flex items-center justify-center font-black text-lg">
                      {rank}
                    </div>
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        <Icon className="w-4 h-4" />
                        {isGold
                          ? "冠军战队"
                          : isSilver
                          ? "亚军战队"
                          : isBronze
                          ? "季军战队"
                          : `第 ${rank} 名`}
                      </div>
                      <div className="text-xs text-muted-foreground">每位成员</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-amber-300 flex items-center gap-1 justify-end">
                      <Coins className="w-5 h-5" />
                      {coins.toLocaleString()}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Coins
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 玩法指引 */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Swords className="w-6 h-6 text-primary" /> 如何参与
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                step: "01",
                title: "加入或创建战队",
                desc: "进入「战队」面板创建战队或申请加入心仪战队，队长批准后即可参战。",
                icon: Users,
              },
              {
                step: "02",
                title: "进入挑战页面",
                desc: "在首页点击「挑战」→「战队挑战」即可查看赛季信息、剩余时间和实时积分榜。",
                icon: Flag,
              },
              {
                step: "03",
                title: "打排位赢积分",
                desc: "排位赛每胜一场战队 +1 分，鼓励全员高频出战，连胜越多积分增长越快。",
                icon: Swords,
              },
              {
                step: "04",
                title: "赛季结算领奖",
                desc: "赛季结束后由管理员一键结算，奖励狄邦豆自动发放到每位上榜成员账户。",
                icon: Coins,
              },
            ].map(({ step, title, desc, icon: Icon }) => (
              <Card key={step} className="border-border/60 bg-card/60">
                <CardContent className="p-5 flex gap-4">
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-primary/70 tracking-widest">
                      STEP {step}
                    </div>
                    <div className="text-base font-semibold mt-0.5">{title}</div>
                    <div className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      {desc}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 战术建议 */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" /> 上分小贴士
          </h2>
          <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent">
            <CardContent className="p-6 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {[
                "鼓励队友每日打开排位赛，积分按胜场累计，出勤即增量。",
                "组队前先在战队群中约时间，错峰打排位避免互相匹配。",
                "学习模块通关 + 答题正确率高，可提高对局表现 and 连胜率。",
                "查看商城连击音效包，让连杀更有仪式感、心态更稳。",
                "队长可在战队公告中设置「每日最低胜场目标」凝聚战力。",
                "关注「战队挑战」实时榜单，落后时迅速发起冲分号召。",
              ].map((tip, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-amber-400 font-bold shrink-0">·</span>
                  <span className="text-muted-foreground leading-relaxed">{tip}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 注意事项 */}
        <section>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-5 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm text-muted-foreground leading-relaxed space-y-1">
                <div className="font-semibold text-foreground">公平竞赛守则</div>
                <div>· 禁止小号刷分、合谋送分，违者将清空赛季积分 and 取消领奖资格。</div>
                <div>· 自由对战、单人挑战不计入战队积分。</div>
                <div>· 赛季中途加入战队的成员，可参与剩余赛程并按最终排名领奖。</div>
                <div>· 最终解释权归狄邦单词通运营团队所有。</div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 页脚 */}
        <footer className="text-center text-xs text-muted-foreground pt-6 pb-2 print:pt-2">
          © 狄邦单词通 · 战队挑战赛 第一赛季「起源」赛季手册
        </footer>
      </div>
    </div>
  );
};

export default SeasonManual;
