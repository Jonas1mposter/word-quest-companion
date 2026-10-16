import { describe, expect, it } from "vitest";
import { ALL_GRADES, contentGrade, zoneName } from "@/lib/zones";
describe("高中 G9–G12 分区", () => {
  it("年级可选到 12", () => { expect(ALL_GRADES).toContain(12); expect(ALL_GRADES).toContain(10); });
  it("G10–G12 共用高中词库与匹配", () => { expect(contentGrade(12)).toBe(9); expect(contentGrade(10)).toBe(9); expect(contentGrade(8)).toBe(8); });
  it("名称区分年级", () => { expect(zoneName(11)).toBe("高中 G11"); });
});
