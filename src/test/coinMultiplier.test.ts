import { describe, it, expect } from "vitest";
import { coinMultiplier, isBeijingWeekend } from "../supabase/functions/_shared/weekend";

// 周末双倍豆：北京时间（UTC+8）周六/周日翻倍
// 构造规则：UTC 时间 + 8 小时即为北京时间
describe("coinMultiplier (weekend double beans)", () => {
  it("周六（北京时间）返回 2", () => {
    // 2026-10-17 是周六；UTC 2026-10-16T20:00Z + 8h = 北京 2026-10-17 04:00 周六
    expect(coinMultiplier(new Date("2026-10-16T20:00:00Z"))).toBe(2);
    expect(isBeijingWeekend(new Date("2026-10-16T20:00:00Z"))).toBe(true);
  });

  it("周日（北京时间）返回 2，跨到周一前都算", () => {
    // UTC 2026-10-18T14:00Z + 8h = 北京 2026-10-18 22:00 周日
    expect(coinMultiplier(new Date("2026-10-18T14:00:00Z"))).toBe(2);
    // UTC 2026-10-18T15:59Z + 8h = 北京 23:59 周日，仍是周末
    expect(coinMultiplier(new Date("2026-10-18T15:59:00Z"))).toBe(2);
  });

  it("周一（北京时间）返回 1", () => {
    // UTC 2026-10-18T16:00Z + 8h = 北京 2026-10-19 00:00 周一
    expect(coinMultiplier(new Date("2026-10-18T16:00:00Z"))).toBe(1);
    expect(isBeijingWeekend(new Date("2026-10-18T16:00:00Z"))).toBe(false);
  });

  it("工作日返回 1", () => {
    // UTC 2026-10-14T02:00Z + 8h = 北京 10:00 周三
    expect(coinMultiplier(new Date("2026-10-14T02:00:00Z"))).toBe(1);
    expect(isBeijingWeekend(new Date("2026-10-14T02:00:00Z"))).toBe(false);
  });
});
