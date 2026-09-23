import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, MousePointerClick } from "lucide-react";

type Step = { target?: string; title: string; body: string; click?: boolean };

// target = value of data-tour attribute. click = user must click the highlighted element to continue.
const STEPS: Step[] = [
  { title: "欢迎来到狄邦单词通！", body: "我会一步步带你点一遍主要按钮，大约 1 分钟。随时可以点「跳过」。" },
  { target: "zone", title: "你的年级分区", body: "这里显示你所在的分区。点它可以切换年级，每个分区的词库、排位和排行榜都是独立的。" },
  { target: "stats", title: "你的数据", body: "等级、经验、体力、狄邦豆和连续打卡天数都在这里。闯关会消耗体力。" },
  { target: "quests", title: "每日任务", body: "每天完成任务就能领狄邦豆和经验，完成后记得点「领取奖励」。" },
  { target: "levels", title: "学习关卡", body: "按单元闯关：先看单词卡（可点喇叭听发音），再做练习题。" },
  { target: "nav-learn", title: "点击「闯关」", body: "来，点一下这个按钮，进入闯关页面。", click: true },
  { target: "nav-wrongbook", title: "点击「错题本」", body: "答错的词会自动收进错题本，点进去看看。", click: true },
  { target: "nav-battle-select", title: "点击「排位赛」", body: "学会了就来对战！排位赛能冲段位（青铜→王者），答得又快又准还能连杀。", click: true },
  { target: "nav-bot", title: "点击「人机」", body: "不想和真人比？人机模式有三档难度，适合练手。", click: true },
  { target: "nav-seasonpass", title: "点击「手册」", body: "赛季手册随经验升级，每一级都有奖励可领。", click: true },
  { target: "nav-friends", title: "点击「好友」", body: "在这里加好友、聊天、邀请 1v1 对战和观战。", click: true },
  { target: "nav-leaderboard", title: "点击「排行榜」", body: "排行榜前几名每周日会收到专属名片。", click: true },
  { target: "nav-profile", title: "点击「个人」", body: "你的个人主页：徽章、称号、名片和战绩都在这里。", click: true },
  { target: "shop", title: "商城", body: "用狄邦豆在这里抽名片、买音效包、补充体力。" },
  { target: "help", title: "随时重看教程", body: "忘了怎么玩？点这个问号就能再看一遍。准备好了，开始你的单词冒险吧！" },
];

const PAD = 8;
const TIP_W = 320;

interface Props { open: boolean; onClose: () => void; }

const findEl = (t?: string) => (t ? (document.querySelector(`[data-tour="${t}"]`) as HTMLElement | null) : null);

const OnboardingTour = ({ open, onClose }: Props) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tipH, setTipH] = useState(180);
  const tipRef = useRef<HTMLDivElement>(null);
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const goHome = () => findEl("nav-home")?.click();
  const finish = () => { goHome(); setStep(0); onClose(); };
  const next = () => {
    let n = step + 1;
    while (n < STEPS.length && STEPS[n].target && !findEl(STEPS[n].target)) n++; // skip missing targets
    if (n >= STEPS.length) finish(); else setStep(n);
  };

  useEffect(() => { if (open) { setStep(0); goHome(); } }, [open]);

  // Scroll target into view on step change
  useEffect(() => {
    if (!open) return;
    const el = findEl(s.target);
    el?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }, [open, step]);

  // Track target position every frame (handles scroll / layout changes)
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const tick = () => {
      const el = findEl(s.target);
      const r = el?.getBoundingClientRect() ?? null;
      setRect((prev) =>
        prev && r && prev.x === r.x && prev.y === r.y && prev.width === r.width && prev.height === r.height ? prev : r
      );
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [open, step]);

  // Wait for the user to click the highlighted element
  useEffect(() => {
    if (!open || !s.click) return;
    const el = findEl(s.target);
    if (!el) return;
    const onClick = () => setTimeout(next, 300);
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [open, step]);

  useLayoutEffect(() => {
    if (tipRef.current) setTipH(tipRef.current.offsetHeight);
  });

  if (!open) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const hole = rect && s.target
    ? { x: rect.left - PAD, y: rect.top - PAD, w: rect.width + PAD * 2, h: rect.height + PAD * 2 }
    : null;

  let tipStyle: React.CSSProperties;
  if (hole) {
    const w = Math.min(TIP_W, vw - 24);
    const left = Math.max(12, Math.min(hole.x + hole.w / 2 - w / 2, vw - w - 12));
    const below = hole.y + hole.h + 12;
    const top = below + tipH < vh - 12 ? below : Math.max(12, hole.y - tipH - 12);
    tipStyle = { left, top: Math.min(top, vh - tipH - 12), width: w };
  } else {
    const w = Math.min(380, vw - 24);
    tipStyle = { left: (vw - w) / 2, top: vh / 2 - tipH / 2, width: w };
  }

  const blocker = "fixed pointer-events-auto";
  return createPortal(
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {hole ? (
        <>
          {/* click blockers around the hole */}
          <div className={blocker} style={{ left: 0, top: 0, width: vw, height: Math.max(0, hole.y) }} />
          <div className={blocker} style={{ left: 0, top: hole.y + hole.h, width: vw, bottom: 0 }} />
          <div className={blocker} style={{ left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }} />
          <div className={blocker} style={{ left: hole.x + hole.w, top: hole.y, right: 0, height: hole.h }} />
          {!s.click && <div className={blocker} style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />}
          {/* spotlight */}
          <div
            className="fixed rounded-xl ring-2 ring-primary transition-all duration-300"
            style={{
              left: hole.x, top: hole.y, width: hole.w, height: hole.h,
              boxShadow: "0 0 0 9999px hsl(var(--background) / 0.8), 0 0 24px hsl(var(--primary) / 0.6)",
            }}
          />
          {s.click && (
            <div className="fixed rounded-xl ring-4 ring-primary/60 animate-ping"
              style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
          )}
        </>
      ) : (
        <div className={`${blocker} inset-0 bg-background/80`} />
      )}

      <div
        ref={tipRef}
        style={tipStyle}
        className="fixed pointer-events-auto rounded-2xl border border-primary/40 bg-card p-4 shadow-2xl animate-in fade-in zoom-in-95"
      >
        <div className="flex items-center gap-2 mb-1">
          {s.click ? <MousePointerClick className="w-5 h-5 text-primary" /> : <Sparkles className="w-5 h-5 text-primary" />}
          <h3 className="font-gaming text-lg">{s.title}</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-muted-foreground">{step + 1} / {STEPS.length}</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={finish}>跳过</Button>
            {s.click ? (
              <Button size="sm" variant="outline" onClick={next}>跳过此步</Button>
            ) : (
              <Button size="sm" onClick={last ? finish : next}>{last ? "开始使用" : "下一步"}</Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default OnboardingTour;
