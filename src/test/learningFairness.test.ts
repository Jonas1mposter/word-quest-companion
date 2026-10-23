import { describe, it, expect } from "vitest";
import { learningCoinReward } from "../../supabase/functions/_shared/learningReward";
import { learningOptions } from "@/lib/learningOptions";

describe("learning rewards scale with workload", () => {
  it("one correct question earns less than ten correct questions", () => {
    expect(learningCoinReward(1, 1, 1).coinsGained).toBe(3);
    expect(learningCoinReward(10, 10, 1).coinsGained).toBe(37);
  });
  it("scales perfect bonus and retains weekend doubling", () => {
    expect(learningCoinReward(1, 1, 2)).toEqual({ coinsGained: 6, perfectBonus: 2 });
    expect(learningCoinReward(10, 10, 2)).toEqual({ coinsGained: 74, perfectBonus: 20 });
    expect(learningCoinReward(10, 5, 1)).toEqual({ coinsGained: 16, perfectBonus: 0 });
  });
  it("rejects fractional and out-of-range counts", () => {
    expect(() => learningCoinReward(1.5, 1, 1)).toThrow();
    expect(() => learningCoinReward(10, 0.5, 1)).toThrow();
    expect(() => learningCoinReward(1, 2, 1)).toThrow();
  });
});
describe("single-word levels", () => {
  const correct = { word: "apple", meaning: "苹果" };
  const pool = [correct, { word: "pear", meaning: "梨" }, { word: "grape", meaning: "葡萄" }, { word: "peach", meaning: "桃" }];
  it("has four distinct meaning options using wider vocabulary", () => {
    const options = learningOptions(correct, [correct, ...pool, pool[1]]);
    expect(options).toHaveLength(4);
    expect(new Set(options).size).toBe(4);
    expect(options.filter(v => v === "苹果")).toHaveLength(1);
  });
  it("has four distinct reverse options", () => {
    expect(new Set(learningOptions(correct, pool, "word"))).toEqual(new Set(["apple", "pear", "grape", "peach"]));
  });
  it("never offers a lone correct answer or ambiguous synonymous alternatives", () => {
    expect(learningOptions(correct, [correct])).toEqual([]);
    expect(learningOptions(correct, [correct, { word: "APPLE", meaning: "苹果果实" }, pool[1], pool[2]])).toEqual([]);
  });
});