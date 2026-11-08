import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/hooks/useMatchSounds", () => ({ useMatchSounds: () => ({ playCombo: vi.fn(), playWrong: vi.fn() }) }));
vi.mock("@/hooks/useSpeech", () => ({ speakWord: vi.fn() }));
import DacBadge from "@/components/battle/DacBadge";
import ServerBattleQuizCard from "@/components/battle/ServerBattleQuizCard";
import { findAutomationMarkers } from "@/lib/dacExtension";
import { guardAnswerEvent } from "@/lib/dacAnswerEvent";

function props(element: Element): Record<string, (event: unknown) => void> {
  const key = Object.getOwnPropertyNames(element).find(k => k.startsWith("__reactProps$"));
  if (!key) throw new Error("React handlers not attached");
  return (element as unknown as Record<string, Record<string, (event: unknown) => void>>)[key];
}
const fake = (target: Element) => ({ nativeEvent: { isTrusted: true }, currentTarget: target, target, preventDefault() {} });
afterEach(() => { cleanup(); rpc.mockClear(); for (const attr of Array.from(document.documentElement.attributes)) if (attr.name.startsWith("data-x") || attr.name === "data-dabc123") document.documentElement.removeAttribute(attr.name); });
describe("v1.16 sample bypass defense", () => {
  it("rejects directly invoked React answers and retains the two-attempt kick rule", () => {
    const onAnswer = vi.fn(), onForfeit = vi.fn();
    render(<><DacBadge onForfeit={onForfeit} /><ServerBattleQuizCard question={{ questionIndex: 0, total: 15, word: "apple", options: ["苹果", "梨"] }} comboCount={0} onAnswer={onAnswer} /></>);
    const button = screen.getByRole("button", { name: "苹果" });
    act(() => props(button).onClick(fake(button)));
    expect(onAnswer).not.toHaveBeenCalled(); expect(onForfeit).not.toHaveBeenCalled();
    act(() => props(button).onClick(fake(button)));
    expect(onForfeit).toHaveBeenCalledWith("synthetic_input", { synthetic: 2, extension: 0 });
  });
  it("rejects a real but undispatched Event masquerading as native input", () => {
    const button = document.createElement("button");
    expect(guardAnswerEvent({ nativeEvent: new Event("click"), currentTarget: button })).toBe(false);
  });
  it("rejects direct fill-state callbacks and programmatic requestSubmit", () => {
    const onAnswer = vi.fn(), onForfeit = vi.fn();
    render(<><DacBadge onForfeit={onForfeit} /><ServerBattleQuizCard question={{ questionIndex: 0, total: 15, quizType: "spelling", prompt: "苹果", options: [] }} comboCount={0} onAnswer={onAnswer} /></>);
    const input = screen.getByRole("textbox") as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "apple");
    act(() => props(input).onChange(fake(input)));
    const form = input.closest("form");
    if (!form) throw new Error("Missing form");
    act(() => props(form).onSubmit(fake(form)));
    expect(onAnswer).not.toHaveBeenCalled(); expect(onForfeit).toHaveBeenCalledTimes(1);
  });
  it("correlates randomized markers and active shield without capturing private content", async () => {
    const onForfeit = vi.fn(); render(<DacBadge onForfeit={onForfeit} />);
    await act(async () => {
      const root = document.documentElement;
      root.setAttribute("data-dabc123", "xabc123");
      root.setAttribute("data-xabc123-v", "1.16.0-2026-10-26-xabc123");
      root.setAttribute("data-xabc123-cap", "s"); root.setAttribute("data-xabc123-s", "1");
    });
    expect(findAutomationMarkers()).toEqual(["wordmaster_grabber_random_bridge", "wordmaster_grabber_listener_shield"]);
    expect(rpc).toHaveBeenCalledWith("report_dac_evidence", expect.objectContaining({ p_kind: "extension_injection", p_meta: expect.objectContaining({ markers: ["wordmaster_grabber_random_bridge", "wordmaster_grabber_listener_shield"] }) }));
    expect(onForfeit).not.toHaveBeenCalled();
  });
  it("does not report an unrelated random attribute without corroboration", () => {
    const root = document.createElement("div"); root.setAttribute("data-dabc123", "xabc123");
    expect(findAutomationMarkers(root)).toEqual([]);
  });
  it("blocks synthetic answers during a health pause without disabling the input guard", () => {
    const onAnswer = vi.fn(), onForfeit = vi.fn();
    render(<><DacBadge status="启动中" onForfeit={onForfeit} /><ServerBattleQuizCard requireInputProof matchId="match" question={{ questionIndex: 0, total: 15, word: "apple", options: ["苹果", "梨"] }} comboCount={0} onAnswer={onAnswer} /></>);
    const button = screen.getByRole("button", { name: "苹果" });
    act(() => button.click());
    expect(onAnswer).not.toHaveBeenCalled();
    expect(onForfeit).not.toHaveBeenCalled();
    act(() => button.click());
    expect(onForfeit).toHaveBeenCalledWith("synthetic_input", { synthetic: 2, extension: 0 });
  });
  it("ranked trust does not depend on a mounted DAC subscriber", () => {
    const onAnswer = vi.fn();
    render(<ServerBattleQuizCard requireInputProof matchId="match" question={{ questionIndex: 0, total: 15, word: "apple", options: ["苹果", "梨"] }} comboCount={0} onAnswer={onAnswer} />);
    act(() => screen.getByRole("button", { name: "苹果" }).click());
    expect(onAnswer).not.toHaveBeenCalled();
  });
});