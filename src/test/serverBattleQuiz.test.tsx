import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/hooks/useSpeech", () => ({ speakWord: vi.fn() }));
vi.mock("@/hooks/useMatchSounds", () => ({ useMatchSounds: () => ({ playCombo: vi.fn(), playWrong: vi.fn() }) }));
vi.mock("@/lib/haptics", () => ({ haptics: { success: vi.fn(), error: vi.fn() } }));
import ServerBattleQuizCard from "@/components/battle/ServerBattleQuizCard";
vi.mock("@/lib/serverBattle", () => ({ fetchBattleAudio: vi.fn().mockRejectedValue(new Error("offline")) }));

describe("服务器判定答题", () => {
  it("拼写题只发用户输入，由服务器判定", async () => {
    const onAnswer = vi.fn().mockResolvedValue(false);
    render(<ServerBattleQuizCard question={{ questionIndex: 2, total: 10, quizType: "spelling", prompt: "苹果", options: [] }} onAnswer={onAnswer} comboCount={0} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "pear" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("pear"));
  });
  it("中译英提交服务器发出的英文选项", async () => {
    const onAnswer = vi.fn().mockResolvedValue(true);
    render(<ServerBattleQuizCard question={{ questionIndex: 1, total: 10, quizType: "reverse", prompt: "苹果", options: ["apple", "pear", "banana", "grape"] }} onAnswer={onAnswer} comboCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "apple" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("apple"));
  });
  it("听力失败后可重播，未播放不允许提交", async () => {
    const onAnswer = vi.fn();
    render(<ServerBattleQuizCard matchId="match" question={{ questionIndex: 3, total: 10, quizType: "listening", prompt: "", options: [] }} onAnswer={onAnswer} comboCount={0} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "apple" } });
    expect(screen.getByRole("button", { name: "确认" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "播放发音" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "播放发音" })).not.toBeDisabled());
    expect(onAnswer).not.toHaveBeenCalled();
  });
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