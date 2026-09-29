import { useCallback, useEffect, useState } from "react";

export type UiMode = "tactics" | "classic";

const STORAGE_KEY = "ui-mode";
const EVENT = "ui-mode-change";

function readMode(): UiMode {
  try {
    return localStorage.getItem(STORAGE_KEY) === "classic" ? "classic" : "tactics";
  } catch {
    return "tactics";
  }
}

function applyMode(mode: UiMode) {
  const root = document.documentElement;
  if (mode === "classic") root.classList.add("ui-classic");
  else root.classList.remove("ui-classic");
}

// Apply as early as possible (module import time) to avoid a style flash.
if (typeof document !== "undefined") applyMode(readMode());

export function useUiMode() {
  const [mode, setModeState] = useState<UiMode>(readMode);

  useEffect(() => {
    const onChange = () => setModeState(readMode());
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);

  const setMode = useCallback((m: UiMode) => {
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* noop */
    }
    applyMode(m);
    setModeState(m);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback(() => {
    setMode(readMode() === "classic" ? "tactics" : "classic");
  }, [setMode]);

  return { mode, setMode, toggle, isClassic: mode === "classic" };
}
