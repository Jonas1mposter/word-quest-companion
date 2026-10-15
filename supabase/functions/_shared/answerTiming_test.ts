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

import { analyzeLookup } from "./answerTiming.ts";
const rowsC = (gaps: number[], correct: boolean) => rows(gaps).map((r) => ({ ...r, is_correct: correct }));
const history = [rows(Array(10).fill(2000)), rows(Array(12).fill(2500))];

Deno.test("slow but perfect vs fast baseline is suspicious", () => {
  assertEquals(analyzeLookup(rowsC([7000, 8000, 6500, 9000, 7500, 8200, 7100, 6800], true), history).suspicious, true);
});
Deno.test("slow with many mistakes is not suspicious", () => {
  const cur = rowsC([7000, 8000, 6500, 9000, 7500, 8200, 7100, 6800], true).map((r, i) => ({ ...r, is_correct: i % 2 === 0 }));
  assertEquals(analyzeLookup(cur, history).suspicious, false);
});
Deno.test("normal pace perfect is not suspicious", () => {
  assertEquals(analyzeLookup(rowsC([2200, 2600, 1900, 2400, 2100, 2800, 2300, 2500], true), history).suspicious, false);
});
Deno.test("no baseline never flags", () => {
  assertEquals(analyzeLookup(rowsC([7000, 8000, 6500, 9000, 7500, 8200, 7100, 6800], true), []).suspicious, false);
});
