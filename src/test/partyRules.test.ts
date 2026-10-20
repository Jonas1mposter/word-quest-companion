import { describe, it, expect } from "vitest";
import { canTeamUp2v2, canSelectPartyMode, canHostStartParty } from "@/lib/partyRules";

describe("2v2 组队年级规则", () => {
  it("组队后仅可选择2v2，不可选择单人模式", () => {
    expect(canSelectPartyMode("2v2", true)).toBe(true);
    for (const mode of ["ranked", "levels", "free", "bot", "friends"] as const) {
      expect(canSelectPartyMode(mode, true)).toBe(false);
      expect(canSelectPartyMode(mode, false)).toBe(true);
    }
  });
  it("只有房主且好友已加入时可以开始", () => {
    const party = { leader_id: "host", member_id: "friend", status: "ready" };
    expect(canHostStartParty(party, "host")).toBe(true);
    expect(canHostStartParty(party, "friend")).toBe(false);
    expect(canHostStartParty({ ...party, member_id: null, status: "pending" }, "host")).toBe(false);
  });
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
