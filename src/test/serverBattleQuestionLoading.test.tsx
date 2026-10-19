import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchQuestion = vi.hoisted(() => vi.fn());
vi.mock("@/lib/serverBattle", () => ({ fetchBattleQuestion: fetchQuestion }));
import { useServerBattleQuestion } from "@/hooks/useServerBattleQuestion";

const firstQuestion = { questionIndex: 0, total: 10, quizType: "meaning", prompt: "apple", options: ["苹果", "梨", "香蕉", "葡萄"] };

describe("对战题目加载恢复", () => {
  beforeEach(() => fetchQuestion.mockReset());
  afterEach(() => { cleanup(); vi.useRealTimers(); });

  it("服务器无可作答题目时给出错误，不能留下无题无提示状态", async () => {
    fetchQuestion.mockResolvedValue(null);
    const { result } = renderHook(() => useServerBattleQuestion("match"));
    await waitFor(() => expect(result.current.questionError).toBe("题目加载失败，请重试"));
    expect(result.current.questionLoading).toBe(false);
  });

  it("请求一直不返回时结束等待并允许重试取得第一题", async () => {
    vi.useFakeTimers();
    fetchQuestion.mockImplementationOnce(() => new Promise(() => {})).mockResolvedValue(firstQuestion);
    const { result } = renderHook(() => useServerBattleQuestion("match"));
    expect(result.current.questionLoading).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(result.current.questionError).toBe("题目加载失败，请重试");
    expect(result.current.questionLoading).toBe(false);
    await act(async () => { await result.current.loadQuestion(); });
    expect(result.current.question?.total).toBe(10);
    expect(result.current.questionError).toBeNull();
  });

  it("换局后迟到的旧请求不能覆盖新局第一题", async () => {
    let resolveOld: (value: typeof firstQuestion) => void = () => {};
    fetchQuestion.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockResolvedValue({ ...firstQuestion, prompt: "pear" });
    const { result, rerender } = renderHook(({ id }) => useServerBattleQuestion(id), { initialProps: { id: "old" } });
    rerender({ id: "new" });
    await waitFor(() => expect(result.current.question?.prompt).toBe("pear"));
    await act(async () => resolveOld(firstQuestion));
    expect(result.current.question?.prompt).toBe("pear");
  });
});