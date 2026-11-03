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
export function guardAnswerEvent(event: unknown): boolean {
  const candidate = event as { nativeEvent?: unknown; currentTarget?: unknown } | null;
  const native = candidate?.nativeEvent;
  const target = candidate?.currentTarget;
  const real = native instanceof Event && native.eventPhase !== Event.NONE && observed.has(native) && target instanceof Element &&
    native.composedPath().includes(target);
  const allowed = real && (blockedListeners.size === 0 || (native.isTrusted &&
    (native.type !== "submit" || (target instanceof HTMLFormElement && gestures.has(target)))));
  if (!allowed) for (const listener of blockedListeners) listener("answer_callback");
  return allowed;
}