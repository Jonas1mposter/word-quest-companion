import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const report = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: report } }));
import DacBadge from "@/components/battle/DacBadge";

const visibility = (hidden: boolean) => {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  document.dispatchEvent(new Event("visibilitychange"));
};
describe("DAC只检测可作答期间的真实页面离开", () => {
  beforeEach(() => { vi.useFakeTimers(); report.mockClear(); visibility(false); });
  afterEach(() => { cleanup(); vi.useRealTimers(); visibility(false); });
  it("窗口失焦但页面仍可见不计切屏", () => {
    const forfeit = vi.fn();
    render(<DacBadge onForfeit={forfeit} />);
    act(() => { for (let i = 0; i < 3; i++) { window.dispatchEvent(new Event("blur")); window.dispatchEvent(new Event("focus")); } });
    expect(report).not.toHaveBeenCalled();
    expect(forfeit).not.toHaveBeenCalled();
  });
  it("断网期间切屏和后台60秒不判作弊", () => {
    const forfeit = vi.fn();
    render(<DacBadge onForfeit={forfeit} />);
    act(() => { window.dispatchEvent(new Event("offline")); visibility(true); vi.advanceTimersByTime(60000); visibility(false); });
    expect(report).not.toHaveBeenCalled();
    expect(forfeit).not.toHaveBeenCalled();
  });
  it("加载暂停解除后不沿用故障前的后台计时", () => {
    const forfeit = vi.fn();
    const { rerender } = render(<DacBadge onForfeit={forfeit} />);
    act(() => visibility(true));
    rerender(<DacBadge status="启动中" onForfeit={forfeit} />);
    act(() => vi.advanceTimersByTime(60000));
    act(() => visibility(false));
    rerender(<DacBadge onForfeit={forfeit} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(forfeit).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
  });
  it("健康对局真实切屏第三次仍判负", () => {
    const forfeit = vi.fn();
    render(<DacBadge onForfeit={forfeit} />);
    act(() => { for (let i = 0; i < 3; i++) { visibility(true); visibility(false); } });
    expect(forfeit).toHaveBeenCalledWith("tab_switch_limit", { count: 3 });
  });
});