import { useEffect, useRef, useState } from "react";
import dacLogo from "@/assets/dac-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { isAwayViolation, isSwitchViolation, SWITCH_LIMIT } from "@/lib/dacAway";
import { findExtensionResource, isSyntheticInputViolation, tamperedNatives } from "@/lib/dacExtension";

/**
 * DAC（Dipont Anti-Cheat）对局内常驻角标，固定在右下角。
 * status: 准备阶段「启动中」，答题阶段「监控中」。
 * 「监控中」时启用切屏检测：离开页面会被记录到 DAC 并弹出警告。
 */
type ForfeitFn = (reason: string, meta: Record<string, number>) => void;

const DacBadge = ({ status = "监控中", onForfeit }: { status?: "启动中" | "监控中"; onForfeit?: ForfeitFn }) => {
  const [online, setOnline] = useState(navigator.onLine);
  const onlineRef = useRef(navigator.onLine);
  const monitoring = status === "监控中" && online;
  const [count, setCount] = useState(0);
  const [warn, setWarn] = useState(false);
  const countRef = useRef(0);
  const awayRef = useRef(false);
  const awaySinceRef = useRef(0);
  const [kicked, setKicked] = useState(false);
  const kickedRef = useRef(false);
  const forfeitRef = useRef(onForfeit);
  forfeitRef.current = onForfeit;
  const kick = (reason: string, meta: Record<string, number>) => {
    if (kickedRef.current || !forfeitRef.current) return;
    kickedRef.current = true;
    setKicked(true);
    forfeitRef.current(reason, meta);
  };

  useEffect(() => {
    const onOnline = () => { onlineRef.current = true; setOnline(true); };
    const onOffline = () => { onlineRef.current = false; awayRef.current = false; setOnline(false); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => { window.removeEventListener("online", onOnline); window.removeEventListener("offline", onOffline); };
  }, []);

  useEffect(() => {
    awayRef.current = false;
    awaySinceRef.current = 0;
    if (!monitoring) { setWarn(false); return; }
    const leave = () => {
      if (!onlineRef.current || !navigator.onLine || awayRef.current) return;
      awayRef.current = true;
      awaySinceRef.current = Date.now();
      countRef.current += 1;
      setCount(countRef.current);
      supabase.rpc("report_tab_switch" as any, { p_count: countRef.current, p_mode: location.hash.slice(0, 40) }).then(() => {});
      if (isSwitchViolation(countRef.current)) kick("tab_switch_limit", { count: countRef.current });
    };
    const back = () => {
      if (!awayRef.current) return;
      awayRef.current = false;
      const awayMs = Date.now() - awaySinceRef.current;
      if (isAwayViolation(awayMs)) kick("background_away", { awayMs, count: countRef.current });
      else setWarn(true);
    };
    // 一直挂在后台不回来：后台计时到点也直接判负
    const timer = window.setInterval(() => {
      if (awayRef.current && isAwayViolation(Date.now() - awaySinceRef.current)) {
        kick("background_away", { awayMs: Date.now() - awaySinceRef.current, count: countRef.current });
      }
    }, 1000);
    const onVis = () => (document.hidden ? leave() : back());
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
      awayRef.current = false;
      awaySinceRef.current = 0;
    };
  }, [monitoring]);

  // 自动化操控检测（仅鼠标；触屏和键盘不检测）
  useEffect(() => {
    if (!monitoring || !onForfeit) return;
    const fire = kick;
    if ((navigator as any).webdriver) { fire("webdriver", {}); return; }
    let moves: { x: number; y: number; t: number }[] = [];
    let untrusted = 0, clicks = 0, robotic = 0;
    let last: { x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      moves.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      if (moves.length > 200) moves = moves.slice(-200);
    };
    const onDown = (e: PointerEvent) => {
      if (!e.isTrusted || e.pointerType !== "mouse") return;
      const now = e.timeStamp;
      const recent = moves.filter((m) => now - m.t < 1500);
      const jump = last ? Math.hypot(e.clientX - last.x, e.clientY - last.y) : 0;
      let bot = false;
      if (last && jump > 80 && recent.length <= 1) bot = true; // 瞬移点击
      else if (recent.length >= 6) {
        let path = 0; const sp: number[] = [];
        for (let i = 1; i < recent.length; i++) {
          const d = Math.hypot(recent[i].x - recent[i - 1].x, recent[i].y - recent[i - 1].y);
          path += d; sp.push(d / Math.max(1, recent[i].t - recent[i - 1].t));
        }
        const straight = Math.hypot(recent[recent.length - 1].x - recent[0].x, recent[recent.length - 1].y - recent[0].y);
        const mean = sp.reduce((a, b) => a + b, 0) / sp.length;
        const cv = mean > 0 ? Math.sqrt(sp.reduce((a, b) => a + (b - mean) ** 2, 0) / sp.length) / mean : 0;
        if (straight > 100 && path / straight < 1.005 && cv < 0.05) bot = true; // 完美直线匀速
      }
      clicks++; if (bot) robotic++;
      last = { x: e.clientX, y: e.clientY };
      moves = [];
      if (robotic >= 4 && robotic / clicks >= 0.6) fire("robotic_mouse", { clicks, robotic });
    };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerdown", onDown, true);
    const onClick = (e: MouseEvent) => { if (!e.isTrusted) { untrusted++; if (untrusted >= 2) fire("synthetic_click", { untrusted }); } };
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("click", onClick, true);
    };
  }, [monitoring, !!onForfeit]);

  // 浏览器插件检测：扩展注入、原生函数被改写、脚本合成键盘/输入
  const [extWarn, setExtWarn] = useState(false);
  useEffect(() => {
    if (!monitoring) return;
    const reported = new Set<string>();
    let extSeen = false, synthetic = 0;
    const report = (kind: string, detail: Record<string, unknown>) => {
      if (reported.has(kind)) return;
      reported.add(kind);
      supabase.rpc("report_dac_evidence" as any, { p_kind: kind, p_meta: { ...detail, mode: location.hash.slice(0, 40) } }).then(() => {});
    };
    const onExt = (url: string) => {
      extSeen = true; setExtWarn(true);
      report("extension_injection", { url });
    };
    const initial = findExtensionResource(document);
    if (initial) onExt(initial);
    const tampered = tamperedNatives();
    if (tampered.length) report("native_tamper", { fns: tampered });
    const mo = new MutationObserver((muts) => {
      for (const m of muts) for (const n of Array.from(m.addedNodes)) {
        if (n instanceof Element) { const u = findExtensionResource(n); if (u) return onExt(u); }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    const onInput = (e: Event) => {
      if (e.isTrusted) return;
      synthetic++;
      report("synthetic_input", { type: e.type, extension: extSeen });
      if (isSyntheticInputViolation(synthetic)) kick("synthetic_input", { synthetic, extension: extSeen ? 1 : 0 });
    };
    for (const t of ["keydown", "input", "beforeinput"]) window.addEventListener(t, onInput, true);
    return () => {
      mo.disconnect();
      for (const t of ["keydown", "input", "beforeinput"]) window.removeEventListener(t, onInput, true);
    };
  }, [monitoring]);

  const kickMsg = "DAC 检测到违规（疑似 AI/脚本/浏览器插件操控或长时间离开对局），本局判负并已记录";
  return (
    <>
      {kicked && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] border border-destructive/60 bg-card px-4 py-3 flex items-center gap-2">
          <img src={dacLogo} alt="DAC" className="w-6 h-6 object-contain" />
          <span className="text-sm">{kickMsg}</span>
        </div>
      )}
      <div className="fixed bottom-3 right-3 z-50 pointer-events-none select-none">
        <div className="val-cut-sm flex items-center gap-1.5 px-2.5 py-1.5 bg-background/85 backdrop-blur border border-primary/50 shadow-[0_0_12px_hsl(var(--primary)/0.25)]">
          <img src={dacLogo} alt="DAC" className="w-5 h-5 object-contain" />
          <span className="font-tactical text-[10px] uppercase tracking-widest text-muted-foreground leading-none">
            Dipont Anti-Cheat <span className="text-primary">{online ? status : "启动中"}</span>
          </span>
        </div>
      </div>
      {warn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur p-6">
          <div className="max-w-sm w-full border border-destructive/60 bg-card p-6 text-center space-y-3">
            <img src={dacLogo} alt="DAC" className="w-16 h-16 object-contain mx-auto" />
            <h2 className="font-tactical text-xl uppercase tracking-widest text-destructive">DAC 检测到切屏</h2>
            <p className="text-sm text-muted-foreground">
              对局中禁止离开页面查答案。本局已切屏 <span className="text-destructive font-bold">{count}</span> 次，已记录到 DAC。累计 {SWITCH_LIMIT} 次将直接踢出对局并判负。
            </p>
            <Button variant="destructive" className="w-full" onClick={() => setWarn(false)}>我知道了，继续对局</Button>
          </div>
        </div>
      )}
    </>
  );
};

export default DacBadge;
