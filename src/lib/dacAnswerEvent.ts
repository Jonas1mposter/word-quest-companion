/** Browser-observed events, not script-created React lookalikes. */
const observed = new WeakSet<Event>();
const blockedListeners = new Set<(type: string) => void>();
const gestures = new WeakSet<HTMLFormElement>();
const listener: EventListenerObject = { handleEvent(event) {
  observed.add(event);
  if (event.isTrusted && (event.type === "click" || event.type === "keydown")) {
    const target = event.target;
    const form = target instanceof Element ? target.closest("form") : null;
    if (form instanceof HTMLFormElement) {
      gestures.add(form);
      setTimeout(() => gestures.delete(form), 0);
    }
  }
} };
// Object listeners avoid the sample's function-source based listener removal.
if (typeof window !== "undefined") {
  for (const type of ["click", "keydown", "input", "change", "beforeinput", "submit"]) {
    window.addEventListener(type, listener, true);
  }
}

export function subscribeBlockedAnswer(listener: (type: string) => void) {
  blockedListeners.add(listener);
  return () => { blockedListeners.delete(listener); };
}

/** Not server attestation: browser-level CDP input remains indistinguishable. */
export function guardAnswerEvent(event: unknown, requireTrusted = false): boolean {
  const candidate = event as { nativeEvent?: unknown; currentTarget?: unknown } | null;
  const native = candidate?.nativeEvent;
  const target = candidate?.currentTarget;
  const real = native instanceof Event && native.eventPhase !== Event.NONE && observed.has(native) && target instanceof Element &&
    native.composedPath().includes(target);
  const allowed = real && ((!requireTrusted && blockedListeners.size === 0) || (native.isTrusted &&
    (native.type !== "submit" || (target instanceof HTMLFormElement && gestures.has(target)))));
  if (!allowed) for (const listener of blockedListeners) listener("answer_callback");
  return allowed;
}

// Local callback hardening only: never send this capability as server attestation.
export type AnswerPermit = Readonly<{ readonly kind: "dac-answer" }>;
const permits = new WeakMap<AnswerPermit, { matchId: string; questionIndex: number; answer: string }>();
export function issueAnswerPermit(event: unknown, matchId: string, questionIndex: number, answer: string): AnswerPermit | undefined {
  if (!guardAnswerEvent(event, true)) return;
  const permit: AnswerPermit = Object.freeze({ kind: "dac-answer" });
  permits.set(permit, { matchId, questionIndex, answer });
  queueMicrotask(() => permits.delete(permit));
  return permit;
}
export function consumeAnswerPermit(permit: AnswerPermit | undefined, matchId: string, questionIndex: number, answer: string): boolean {
  const binding = permit && permits.get(permit);
  if (permit) permits.delete(permit);
  const allowed = !!binding && binding.matchId === matchId && binding.questionIndex === questionIndex && binding.answer === answer;
  if (!allowed) for (const listener of blockedListeners) listener("answer_callback");
  return allowed;
}