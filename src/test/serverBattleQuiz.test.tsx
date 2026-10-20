import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
const webAudio = vi.hoisted(() => ({ start: vi.fn(), decode: vi.fn() }));
vi.mock("@/lib/audioManager", () => ({ audioManager: { ensureReady: async () => ({ state: "running", decodeAudioData: webAudio.decode, createBufferSource: () => ({ buffer: null, connect: vi.fn(), start: webAudio.start, stop: vi.fn() }), destination: {} }) } }));
vi.mock("@/hooks/useSpeech", () => ({ speakWord: vi.fn() }));
vi.mock("@/hooks/useMatchSounds", () => ({ useMatchSounds: () => ({ playCombo: vi.fn(), playWrong: vi.fn() }) }));
vi.mock("@/lib/haptics", () => ({ haptics: { success: vi.fn(), error: vi.fn() } }));
import ServerBattleQuizCard from "@/components/battle/ServerBattleQuizCard";
vi.mock("@/lib/serverBattle", () => ({ fetchBattleAudio: vi.fn().mockRejectedValue(new Error("offline")) }));
vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});

describe("服务器判定答题", () => {
  it("填空题仅在服务器判分响应后显示正确答案", async () => {
    let resolveAnswer: ((value: { ok: boolean; isCorrect: boolean; correctAnswer: string }) => void) | undefined;
    const onAnswer = vi.fn(() => new Promise<{ ok: boolean; isCorrect: boolean; correctAnswer: string }>(resolve => { resolveAnswer = resolve; }));
    render(<ServerBattleQuizCard question={{ questionIndex: 2, total: 10, quizType: "spelling", prompt: "苹果", options: [] }} onAnswer={onAnswer} comboCount={0} />);
    expect(screen.queryByText("apple")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "pear" } });
    fireEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(screen.queryByText("apple")).not.toBeInTheDocument();
    resolveAnswer?.({ ok: true, isCorrect: false, correctAnswer: "apple" });
    await waitFor(() => expect(screen.getByText("apple")).toBeInTheDocument());
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
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
  it("Safari拒绝异步HTML音频时通过已解锁Web Audio播放，不使用答案文字", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new DOMException("Blocked", "NotAllowedError"));
    const oldCreate = URL.createObjectURL;
    const oldRevoke = URL.revokeObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:opaque-audio");
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(600) }));
    webAudio.decode.mockResolvedValue({});
    const loadAudio = vi.fn().mockResolvedValue(new Blob([new Uint8Array(600)]));
    const onAnswer = vi.fn().mockResolvedValue(true);
    try {
      render(<ServerBattleQuizCard loadAudio={loadAudio} question={{ questionIndex: 3, total: 10, quizType: "listening", prompt: "", options: [] }} onAnswer={onAnswer} comboCount={0} />);
      expect(loadAudio).toHaveBeenCalledWith(3);
      fireEvent.click(screen.getByRole("button", { name: "播放发音" }));
      await waitFor(() => expect(webAudio.start).toHaveBeenCalledTimes(1));
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "pear" } });
      fireEvent.click(screen.getByRole("button", { name: "确认" }));
      await waitFor(() => expect(onAnswer).toHaveBeenCalledWith("pear"));
    } finally {
      play.mockRestore(); vi.unstubAllGlobals(); URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    }
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
  it("丢失提交响应后换选项也只重发原答案", async () => {
    const onAnswer = vi.fn().mockRejectedValueOnce(new Error("response lost")).mockResolvedValueOnce(true);
    render(<ServerBattleQuizCard question={{ questionIndex: 0, total: 10, word: "apple", options: ["苹果", "梨", "香蕉", "葡萄"] }} onAnswer={onAnswer} comboCount={0} />);
    fireEvent.click(screen.getByRole("button", { name: "苹果" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "重试原答案" })).not.toBeDisabled());
    expect(screen.getByRole("button", { name: "梨" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "重试原答案" }));
    await waitFor(() => expect(onAnswer).toHaveBeenCalledTimes(2));
    expect(onAnswer.mock.calls).toEqual([["苹果"], ["苹果"]]);
  });
});