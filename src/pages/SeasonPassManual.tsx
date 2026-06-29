import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Printer,
  Crown,
  Coins,
  Zap,
  Gift,
  Star,
  ChevronUp,
  Sparkles,
  Target,
  Clock,
  CheckCircle,
  Lock,
  BookOpen,
  Award,
} from "lucide-react";

const SeasonPassManual = () => {
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
            狄邦赛季手册 · Season Pass S1
          </div>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> 导出 PDF
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 print:py-4 space-y-8">
        {/* 封面 */}
        <section className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/20 via-amber-500/10 to-purple-500/10 p-8 sm:p-12 text-center">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-amber-500/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-primary/30 blur-3xl" />
          <div className="relative">
            <Badge className="mb-4 bg-amber-500/20 text-amber-200 border-amber-500/50 hover:bg-amber-500/30">
              <Sparkles className="w-3.5 h-3.5 mr-1" /> SEASON 01
            </Badge>
            <h1 className="text-4xl sm:text-6xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent tracking-tight">
              S1 赛季手册
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              完成关卡、参与对战，不断升级你的赛季手册，
              <br className="hidden sm:block" />
              解锁海量狄邦豆、专属名片、稀有徽章与能量奖励。
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                <Clock className="w-3.5 h-3.5" /> 按学段赛季轮换
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                <Zap className="w-3.5 h-3.5 text-yellow-400" /> 升级领奖励
              </Badge>
              <Badge variant="outline" className="gap-1.5 py-1.5 px-3">
                <Crown className="w-3.5 h-3.5 text-amber-400" /> 高级版奖励翻倍
              </Badge>
            </div>
          </div>
        </section>

        {/* 赛季概览 */}
        <section className="grid sm:grid-cols-3 gap-4">
          {[
            {
              icon: Target,
              title: "获取经验",
              desc: "每完成一个关卡或赢得一场对战，即可获得赛季经验，提升手册等级。",
            },
            {
              icon: Gift,
              title: "领取奖励",
              desc: "每升一级，都能领取免费奖励；解锁高级版后，同一级可再领高级奖励。",
            },
            {
              icon: Crown,
              title: "高级版",
              desc: "消耗 500 狄邦豆即可激活高级版，独享额外狄邦豆、专属名片与徽章。",
            },
          ].map((item) => (
            <Card key={item.title} variant="gaming" className="border-primary/10">
              <CardContent className="p-6 text-center">
                <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                  <item.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* 快速上手 4 步 */}
        <section>
          <Card variant="gaming" className="border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <BookOpen className="w-5 h-5 text-accent" />
                快速上手 · 4 步
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { step: "1", title: "学习赚经验", desc: "每天完成关卡挑战，连续答对可获得连击加成，经验飞涨。" },
                { step: "2", title: "对战升级", desc: "参与排位赛或自由匹配，无论胜负都能获得赛季经验。" },
                { step: "3", title: "领取奖励", desc: "手册等级提升后，点击对应奖励格子即可领取。" },
                { step: "4", title: "激活高级版", desc: "想要更多资源？花费 500 狄邦豆解锁高级奖励线路。" },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border/50"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-accent">
                    {item.step}
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 奖励类型 */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Award className="w-6 h-6 text-accent" />
            奖励类型
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: Coins,
                title: "狄邦豆",
                desc: "游戏通用货币，可在商城抽取名片、徽章、连击音效。",
              },
              {
                icon: Zap,
                title: "能量",
                desc: "用于继续闯关或匹配，每日会自然恢复。",
              },
              {
                icon: Star,
                title: "徽章",
                desc: "装备后展示在主页与对局中，彰显你的成就。",
              },
              {
                icon: Crown,
                title: "名片称号",
                desc: "个性化你的个人资料，部分为高级版专属。",
              },
            ].map((reward) => (
              <Card key={reward.title} variant="gaming" className="border-primary/10">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <reward.icon className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="font-bold mb-1">{reward.title}</h3>
                    <p className="text-sm text-muted-foreground">{reward.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 免费 vs 高级版 */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="w-6 h-6 text-accent" />
            免费奖励 vs 高级版奖励
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card variant="gaming" className="border-primary/10">
              <CardHeader className="border-b border-border/50">
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-accent" />
                  免费线路
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  所有玩家都能获得，每升一级即可领取：
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" /> 狄邦豆
                  </li>
                  <li className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" /> 能量补给
                  </li>
                  <li className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-purple-400" /> 普通徽章
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card variant="gaming" className="border-amber-500/30 bg-gradient-to-b from-amber-500/5 to-transparent">
              <CardHeader className="border-b border-amber-500/20">
                <CardTitle className="flex items-center gap-2 text-amber-300">
                  <Crown className="w-5 h-5 text-amber-400" />
                  高级版线路
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  花费 500 狄邦豆解锁，同一等级额外获得：
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-amber-400" /> 更多狄邦豆
                  </li>
                  <li className="flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-400" /> 专属名片称号
                  </li>
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-400" /> 稀有徽章
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 经验来源 */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <ChevronUp className="w-6 h-6 text-accent" />
            经验来源
          </h2>
          <Card variant="gaming" className="border-primary/10">
            <CardContent className="p-6 space-y-4">
              {[
                { label: "完成普通关卡", value: "+20 赛季经验" },
                { label: "完美通关（全部正确）", value: "+30 赛季经验" },
                { label: "赢得一场排位赛", value: "+50 赛季经验" },
                { label: "完成一场自由匹配", value: "+30 赛季经验" },
                { label: "连击加成", value: "额外 5%–25% 经验" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <span className="text-sm">{row.label}</span>
                  <Badge variant="secondary" className="font-mono">
                    {row.value}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* 温馨提示 */}
        <section>
          <Card variant="gaming" className="border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="w-5 h-5 text-accent" />
                赛季结束说明
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-2 text-sm text-muted-foreground">
              <p>1. 当前赛季结束后，未领取的奖励将自动发放至账户。</p>
              <p>2. 新赛季开始时，手册等级会重置，但已获得的名片、徽章、狄邦豆永久保留。</p>
              <p>3. 高级版仅在当前赛季有效，新赛季需重新激活。</p>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default SeasonPassManual;
