import { describe, expect, it } from "vitest";
import { classifyForfeit } from "../../supabase/functions/_shared/forfeitReason";
describe("离开对局不等同脚本作弊", () => {
  it.each(["tab_switch_limit", "background_away"])("%s不触发对手脚本作弊提示", reason => {
    expect(classifyForfeit(reason)).toMatchObject({ source: "match_absence", severity: "medium" });
  });
  it("主动退赛不是作弊", () => {
    expect(classifyForfeit("surrender")).toMatchObject({ source: "match_surrender", severity: "low" });
  });
  it.each(["webdriver", "robotic_mouse", "synthetic_click", "invented"])("客户端%s仅记待复核报告", reason => {
    expect(classifyForfeit(reason)).toMatchObject({ source: "client_report", severity: "medium" });
  });
});