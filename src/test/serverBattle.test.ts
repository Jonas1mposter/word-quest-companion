import { beforeEach, describe, expect, it, vi } from "vitest";
const invoke = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));
import { fetchBattleQuestion, submitBattleAnswer } from "@/lib/serverBattle";

describe("服务器逐题对战", () => {
  beforeEach(() => invoke.mockReset());
  it("只请求当前题，不发送题号或正确答案", async () => {
    invoke.mockResolvedValue({ data: { questionIndex: 0, total: 10, word: "apple", options: ["苹果", "梨", "香蕉", "葡萄"] }, error: null });
    const question = await fetchBattleQuestion("match");
    expect(invoke).toHaveBeenCalledWith("match-question", { body: { matchId: "match" } });
    expect(question?.options).toHaveLength(4);
    expect(question).not.toHaveProperty("meaning");
    expect(question).not.toHaveProperty("correctAnswer");
  });
  it("拒绝不满四项的题目", async () => {
    invoke.mockResolvedValue({ data: { questionIndex: 0, word: "apple", options: ["苹果"] }, error: null });
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