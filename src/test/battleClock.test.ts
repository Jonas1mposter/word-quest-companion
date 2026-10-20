import { describe, expect, it } from "vitest";
import { remainingBattleSeconds } from "@/lib/battleClock";
describe("重连不重置对局时间", () => {
  it("对局已开始60秒，重连只剩240秒", () => {
    expect(remainingBattleSeconds("2026-10-20T14:00:00Z", Date.parse("2026-10-20T14:01:00Z"))).toBe(240);
  });
  it("超过五分钟不能得到新的五分钟", () => {
    expect(remainingBattleSeconds("2026-10-20T14:00:00Z", Date.parse("2026-10-20T14:05:00Z"))).toBe(0);
  });
});