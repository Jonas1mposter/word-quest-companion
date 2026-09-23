import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BookOpen, Swords, Trophy, Coins, GraduationCap, Users, Sparkles, ScrollText } from "lucide-react";

const STEPS = [
  { icon: Sparkles, title: "欢迎来到狄邦单词通！", body: "这是一个把背单词变成游戏的平台。接下来用 1 分钟带你认识主要玩法，随时可以跳过。" },
  { icon: GraduationCap, title: "你的年级分区", body: "页头的「专区」徽章显示你所在的年级分区。点它可以切换分区，每个分区的词库、排位、排行榜都是独立的。" },
  { icon: BookOpen, title: "闯关学习", body: "在「学习」里按单元闯关：先看单词卡（可点喇叭听发音），再做练习题。答对得经验和狄邦豆，答错的词会进入错题本方便复习。" },
  { icon: Swords, title: "对战模式", body: "学会了就去对战！排位赛可以冲段位（青铜→王者），自由服轻松练手，还有 2v2 组队和人机对抗。答得又快又准就能连杀。" },
  { icon: Coins, title: "狄邦豆与商城", body: "闯关、对战、每日任务都能赚狄邦豆。在右上角「商城」里用狄邦豆抽名片、买音效包、补充体力。" },
  { icon: ScrollText, title: "每日任务与赛季手册", body: "每天完成任务领奖励；赛季手册随经验升级，解锁更多奖励。别忘了每天回来打卡保持连续天数！" },
  { icon: Users, title: "好友与战队", body: "添加好友可以聊天、邀请 1v1 对战、观战；加入战队（最多 5 人）一起参加赛季挑战赛。" },
  { icon: Trophy, title: "徽章与排行榜", body: "达成成就解锁徽章和称号，展示在个人主页。排行榜前列每周日还会发放专属名片。准备好了吗？开始你的单词冒险吧！" },
];

interface Props { open: boolean; onClose: () => void; }

const OnboardingTour = ({ open, onClose }: Props) => {
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;
  const finish = () => { setStep(0); onClose(); };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && finish()}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-2">
            <Icon className="w-8 h-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">{s.title}</DialogTitle>
          <DialogDescription className="text-center text-base leading-relaxed pt-2">{s.body}</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1.5 py-2">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>跳过</Button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>上一步</Button>}
            <Button onClick={() => (last ? finish() : setStep(step + 1))}>{last ? "开始使用" : "下一步"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OnboardingTour;
