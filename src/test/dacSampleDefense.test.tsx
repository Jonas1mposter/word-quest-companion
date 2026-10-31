import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/hooks/useSpeech", () => ({ speakWord: vi.fn() }));
vi.mock("@/hooks/useMatchSounds", () => ({ useMatchSounds: () => ({ playCombo: vi.fn(), playWrong: vi.fn() }) }));
vi.mock("@/lib/haptics", () => ({ haptics: { success: vi.fn(), error: vi.fn() } }));
import DacBadge from "@/components/battle/DacBadge";
import ServerBattleQuizCard from "@/components/battle/ServerBattleQuizCard";
import { findAutomationMarkers, tamperedNatives } from "@/lib/dacExtension";

describe("DAC uploaded-sample defenses", () => {
  beforeEach(() => { rpc.mockClear(); });
  afterEach(() => { cleanup(); document.getElementById("__tts_captured")?.remove(); });
  it("blocks a synthetic answer before it reaches the grading callback", () => {
    const onAnswer = vi.fn();
    render(<><DacBadge onForfeit={vi.fn()} /><ServerBattleQuizCard question={{ questionIndex: 0, total: 15, word: "apple", options: ["苹果", "梨"] }} comboCount={0} onAnswer={onAnswer} /></>);
    fireEvent.click(screen.getByRole("button", { name: "苹果" }));
    expect(onAnswer).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("report_dac_evidence", expect.objectContaining({ p_kind: "synthetic_input", p_meta: expect.objectContaining({ blocked: true }) }));
  });
  it("retains synthetic attempts across unhealthy pauses and forfeits on the second attempt", () => {
    const forfeit = vi.fn();
    const View = ({ status = "监控中" }: { status?: "监控中" | "启动中" }) => <><DacBadge status={status} onForfeit={forfeit} /><div data-dac-answer-region><button>answer</button></div></>;
    const { rerender } = render(<View />);
    fireEvent.click(screen.getByRole("button", { name: "answer" }));
    expect(forfeit).not.toHaveBeenCalled();
    rerender(<View status="启动中" />);
    rerender(<View />);
    fireEvent.click(screen.getByRole("button", { name: "answer" }));
    expect(forfeit).toHaveBeenCalledTimes(1);
    expect(forfeit).toHaveBeenCalledWith("synthetic_input", { synthetic: 2, extension: 0 });
  });
  it("blocks sample-style native value setting and input dispatch before React sees it", () => {
    const inputHandler = vi.fn(), forfeit = vi.fn();
    render(<><DacBadge onForfeit={forfeit} /><div data-dac-answer-region><input aria-label="answer" onInput={inputHandler} /></div></>);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "apple");
    act(() => { input.dispatchEvent(new Event("input", { bubbles: true })); });
    expect(inputHandler).not.toHaveBeenCalled();
    expect(forfeit).not.toHaveBeenCalled();
    act(() => { input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); });
    expect(forfeit).toHaveBeenCalledWith("synthetic_input", { synthetic: 2, extension: 0 });
  });
  it("does not punish synthetic events in navigation or unrelated inputs", () => {
    const forfeit = vi.fn(), navigate = vi.fn();
    render(<><DacBadge onForfeit={forfeit} /><button onClick={navigate}>settings</button><input aria-label="search" /></>);
    fireEvent.click(screen.getByRole("button", { name: "settings" }));
    fireEvent.input(screen.getByRole("textbox"), { target: { value: "hello" } });
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(forfeit).not.toHaveBeenCalled();
    expect(rpc.mock.calls.filter(c => c[1]?.p_kind === "synthetic_input")).toHaveLength(0);
  });
  it("records the sample TTS bridge without transmitting captured words or forfeiting", async () => {
    const forfeit = vi.fn();
    render(<DacBadge onForfeit={forfeit} />);
    const marker = document.createElement("div"); marker.id = "__tts_captured";
    marker.setAttribute("data-time", "123"); marker.textContent = "private-listening-answer";
    await act(async () => { document.body.appendChild(marker); });
    expect(findAutomationMarkers()).toEqual(["wordmaster_grabber_tts_bridge"]);
    expect(rpc).toHaveBeenCalledWith("report_dac_evidence", expect.objectContaining({ p_kind: "extension_injection", p_meta: expect.objectContaining({ markers: ["wordmaster_grabber_tts_bridge"] }) }));
    expect(JSON.stringify(rpc.mock.calls)).not.toContain("private-listening-answer");
    expect(forfeit).not.toHaveBeenCalled();
  });
  it("detects speech interception separately from network hooks", () => {
    const fakeWindow = { speechSynthesis: { speak: () => undefined } } as unknown as Window & typeof globalThis;
    expect(tamperedNatives(fakeWindow)).toContain("speechSynthesis.speak");
  });
  it("does not mistake a generic hidden element for the sample bridge", () => {
    const root = document.createElement("div"); root.innerHTML = '<div hidden data-time="123">word</div>';
    expect(findAutomationMarkers(root)).toEqual([]);
  });
});