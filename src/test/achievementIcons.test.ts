import { describe, expect, it } from "vitest";
import { achievementIcons, achievementSeries, resolveAchievementIcon } from "@/lib/achievementIcons";
import { getIconComponent, hasIcon } from "@/components/ui/badge-icon";

describe("achievement icon identity rules", () => {
  it("assigns different actual symbols to every unrelated achievement or series", () => {
    const symbols = Object.values(achievementIcons).map(getIconComponent);
    expect(new Set(symbols).size).toBe(symbols.length);
    expect(symbols.every(Boolean)).toBe(true);
  });

  it.each(achievementSeries)("allows only the %s upgrade family to reuse its symbol", series => {
    const icons = ["I", "II", "III", "IV"].map(tier => resolveAchievementIcon(`${series} ${tier}`, "Award"));
    expect(icons).toEqual(Array(4).fill(achievementIcons[series]));
  });

  it("separates historically duplicated crowns, mountains, flames and first-time badges", () => {
    const names = ["GOAT", "优先特权", "大满贯", "巅峰之证", "勇攀高峰 I", "至高巅峰 I", "登峰造极", "坚持不懈 I", "王牌之证", "连击之神", "Bonjour!", "开箱惊喜", "初识词汇", "词汇学者 I", "人机初胜", "降维打击", "以文会友", "双子星"];
    expect(new Set(names.map(name => resolveAchievementIcon(name, "Award"))).size).toBe(names.length);
  });

  it("supports every registered icon without falling back to a generic symbol", () => {
    for (const icon of Object.values(achievementIcons)) expect(hasIcon(icon)).toBe(true);
  });

  it("leaves name cards and unknown future achievements on their stored icons", () => {
    expect(resolveAchievementIcon(undefined, "Gem")).toBe("Gem");
    expect(resolveAchievementIcon("Future achievement", "Star")).toBe("Star");
  });
});