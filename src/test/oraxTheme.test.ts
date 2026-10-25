import { describe, expect, it } from "vitest";
import { isOraxPlayer, ORAX_PACK_ID, ORAX_TONES } from "@/lib/oraxTheme";

describe("ORA X 颗秒", () => {
  it("只有装备 ORA X 颗秒的对手才触发 Eliminated by 提示", () => {
    expect(isOraxPlayer({ active_kill_sound_pack_id: ORAX_PACK_ID })).toBe(true);
    expect(isOraxPlayer({ active_kill_sound_pack_id: "other" })).toBe(false);
    expect(isOraxPlayer(null)).toBe(false);
  });
  it("提供 5 套局内色调", () => {
    expect(Object.keys(ORAX_TONES)).toEqual(["ignition", "lawyer", "raja", "renegade", "watch"]);
  });
});
