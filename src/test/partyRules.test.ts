import { describe, it, expect } from "vitest";
import { canTeamUp2v2 } from "@/lib/partyRules";

describe("2v2 组队年级规则", () => {
  it("同年级可以组队", () => {
    expect(canTeamUp2v2(7, 7)).toBe(true);
    expect(canTeamUp2v2(3, 3)).toBe(true);
  });

  it("不同年级不能组队", () => {
    expect(canTeamUp2v2(7, 8)).toBe(false);
    expect(canTeamUp2v2(6, 7)).toBe(false);
  });

  it("初高中边界：8 年级不能与 9 年级组队", () => {
    expect(canTeamUp2v2(8, 9)).toBe(false);
  });

  it("高中 9-12 年级共用词库，可以互相组队", () => {
    expect(canTeamUp2v2(9, 12)).toBe(true);
    expect(canTeamUp2v2(10, 11)).toBe(true);
  });

  it("小学与初中不能跨段组队", () => {
    expect(canTeamUp2v2(5, 7)).toBe(false);
  });
});
