import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/hooks/useSpeech", () => ({ speakWord: vi.fn() }));
vi.mock("@/hooks/useMatchSounds", () => ({ useMatchSounds: () => ({ playCombo: vi.fn(), playWrong: vi.fn() }) }));
vi.mock("@/lib/haptics", () => ({ haptics: { success: vi.fn(), error: vi.fn() } }));
import ServerBattleQuizCard from "@/components/battle/ServerBattleQuizCard";

describe("服务器判定答题", () => {
  it("等待服务器判定且失败后允许重试同一选项", async () => {
    const onAnswer = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(true);
    render(<ServerBattleQuizCard question={{ questionIndex: 0, total: 10, word: "apple", options: ["苹果", "梨", "香蕉", "葡萄"] }} onAnswer={onAnswer} comboCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "苹果" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "苹果" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "苹果" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
    expect(onAnswer.mock.calls).toEqual([["苹果"], ["苹果"]]);
    await waitFor(() => expect(screen.getByRole("button", { name: "梨" })).toBeDisabled());
  });
});