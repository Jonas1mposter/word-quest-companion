import { describe, expect, it } from "vitest";
import { AWAY_LIMIT_MS, isAwayViolation } from "@/lib/dacAway";

describe("DAC 切屏判负宽限期", () => {
  it("离开 15 秒不再判负（旧规则太严格）", () => {
    expect(isAwayViolation(15000)).toBe(false);
    expect(isAwayViolation(59999)).toBe(false);
  });

  it("连续离开 60 秒才判负", () => {
    expect(AWAY_LIMIT_MS).toBe(60000);
    expect(isAwayViolation(60000)).toBe(true);
    expect(isAwayViolation(90000)).toBe(true);
  });

  it("马上切回来不算违规", () => {
    expect(isAwayViolation(0)).toBe(false);
    expect(isAwayViolation(3000)).toBe(false);
  });
});

import { isSwitchViolation, SWITCH_LIMIT } from "@/lib/dacAway";
describe("DAC 累计切屏判负", () => {
  it("切屏 1–2 次只警告", () => {
    expect(isSwitchViolation(1)).toBe(false);
    expect(isSwitchViolation(2)).toBe(false);
  });
  it("累计第 3 次直接判负", () => {
    expect(SWITCH_LIMIT).toBe(3);
    expect(isSwitchViolation(3)).toBe(true);
  });
});
