import { beforeEach, describe, expect, it, vi } from "vitest";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
import { fetchBattleQuestion, submitBattleAnswer } from "@/lib/serverBattle";

describe("服务器逐题对战", () => {
  beforeEach(() => invoke.mockReset());
  it("只请求当前题，不发送题号或正确答案", async () => {
    invoke.mockResolvedValue({ data: { questionIndex: 0, total: 10, word: "apple", options: ["苹果", "梨", "香蕉", "葡萄"] }, error: null });
    const question = await fetchBattleQuestion("match");
    expect(invoke).toHaveBeenCalledWith("match-question", { body: { matchId: "match", protocol: 2 } });
    expect(question?.options).toHaveLength(4);
    expect(question).not.toHaveProperty("meaning");
    expect(question).not.toHaveProperty("correctAnswer");
  });
  it("拒绝不满四项的题目", async () => {
    invoke.mockResolvedValue({ data: { questionIndex: 0, word: "apple", options: ["苹果"] }, error: null });
    await expect(fetchBattleQuestion("match")).rejects.toThrow();
  });
  it.each([{ total: 0, questionIndex: 0 }, { total: 10, questionIndex: -1 }, { total: 10, questionIndex: 10 }])("拒绝无效进度 $questionIndex/$total", async progress => {
    invoke.mockResolvedValue({ data: { ...progress, word: "apple", options: ["苹果", "梨", "香蕉", "葡萄"] }, error: null });
    await expect(fetchBattleQuestion("match")).rejects.toThrow();
  });
  it.each(["reverse", "spelling", "listening"])("接收%s题但不保留服务器多余的答案字段", async quizType => {
    invoke.mockResolvedValue({ data: { questionIndex: 2, total: 10, quizType, prompt: quizType === "listening" ? "" : "苹果", options: quizType === "reverse" ? ["apple", "pear", "banana", "grape"] : [], correctAnswer: "apple" }, error: null });
    const question = await fetchBattleQuestion("match");
    expect(question?.quizType).toBe(quizType);
    expect(question).not.toHaveProperty("word");
    expect(question).not.toHaveProperty("correctAnswer");
  });
  it("拒绝听力题中的答案文字", async () => {
    invoke.mockResolvedValue({ data: { questionIndex: 3, total: 10, quizType: "listening", prompt: "apple", options: [] }, error: null });
    await expect(fetchBattleQuestion("match")).rejects.toThrow();
  });
  it("提交不包含客户端正确性或可篡改题型", async () => {
    invoke.mockResolvedValue({ data: { ok: true, isCorrect: false }, error: null });
    expect((await submitBattleAnswer("match", 0, "梨", 3000)).isCorrect).toBe(false);
    expect(invoke).toHaveBeenCalledWith("submit-answer", { body: { matchId: "match", questionIndex: 0, answer: "梨", elapsedMs: 3000 } });
  });
  it("服务器失败时不回退到本地判定", async () => {
    invoke.mockResolvedValue({ data: null, error: new Error("offline") });
    await expect(submitBattleAnswer("match", 0, "苹果", 3000)).rejects.toThrow("答案提交失败");
  });
});