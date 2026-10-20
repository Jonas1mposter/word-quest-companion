import { describe, expect, it } from "vitest";
import { earnsDimensionalStrike, earnsTwinStars } from "../../supabase/functions/_shared/matchBadges";

describe("最终比分称号条件", () => {
  it("降维打击领先8分即可，无需零封", () => {
    expect(earnsDimensionalStrike(10, 2)).toBe(true);
    expect(earnsDimensionalStrike(7, -1)).toBe(true);
    expect(earnsDimensionalStrike(10, 3)).toBe(false);
  });
  it("双子星队伍领先15分即可", () => {
    expect(earnsTwinStars(25, 10)).toBe(true);
    expect(earnsTwinStars(24, 10)).toBe(false);
    expect(earnsTwinStars(10, 25)).toBe(false);
  });
});