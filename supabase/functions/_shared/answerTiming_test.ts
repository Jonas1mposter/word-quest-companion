import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { analyzeTiming } from "./answerTiming.ts";

const rows = (gaps: number[], empty: number[] = []) => {
  let t = Date.UTC(2026, 0, 1);
  const out = [{ answered_at: new Date(t).toISOString(), answer: "a" }];
  gaps.forEach((g, i) => { t += g; out.push({ answered_at: new Date(t).toISOString(), answer: empty.includes(i) ? "" : "a" }); });
  return out;
};

Deno.test("fixed 3s pace is robotic", () => {
  assertEquals(analyzeTiming(rows([3000, 3010, 2990, 3005, 2995, 3000, 3002])).robotic, true);
});
Deno.test("human-like varied pace is not robotic", () => {
  assertEquals(analyzeTiming(rows([2100, 4800, 3300, 6900, 2600, 5200, 3900])).robotic, false);
});
Deno.test("fewer than 6 intervals never flags", () => {
  assertEquals(analyzeTiming(rows([3000, 3000, 3000, 3000, 3000])).robotic, false);
});
Deno.test("timeouts (empty answers) are ignored", () => {
  assertEquals(analyzeTiming(rows([15000, 15000, 15000, 15000, 15000, 15000, 15000], [0, 1, 2, 3, 4, 5, 6])).robotic, false);
});
