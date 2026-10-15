import { describe, it, expect } from "vitest";
import { isAnswerCorrect } from "@/lib/answerMatch";

describe("拼写判定", () => {
  it("不打括号部分也算对", () => expect(isAnswerCorrect("deadweight loss", "deadweight loss (DWL)")).toBe(true));
  it("连括号一起打也算对", () => expect(isAnswerCorrect("deadweight loss (DWL)", "deadweight loss (DWL)")).toBe(true));
  it("只打缩写也算对", () => expect(isAnswerCorrect("dwl", "deadweight loss (DWL)")).toBe(true));
  it("说明性括号不能单独当答案", () => expect(isAnswerCorrect("trig", "tangent (trig)")).toBe(false));
  it("斜杠任一写法都算对", () => {
    expect(isAnswerCorrect("tires", "tyres / tires")).toBe(true);
    expect(isAnswerCorrect("tyres", "tyres / tires")).toBe(true);
  });
  it("拼错仍然判错", () => expect(isAnswerCorrect("deadwieght loss", "deadweight loss (DWL)")).toBe(false));
  it("空答案判错", () => expect(isAnswerCorrect("  ", "apple")).toBe(false));
  it("大小写和多余空格不影响", () => expect(isAnswerCorrect("  Apple ", "apple")).toBe(true));
});
