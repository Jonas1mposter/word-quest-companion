import { afterEach, describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

describe("visible-word device fallback", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
  });

  async function setup(fails: boolean) {
    vi.useFakeTimers();
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      speak, cancel: vi.fn(), resume: vi.fn(), getVoices: () => [], addEventListener: vi.fn(),
    });
    vi.stubGlobal("SpeechSynthesisUtterance", class {
      text: string;
      constructor(text: string) { this.text = text; }
    });
    class FakeAudio {
      onplaying: (() => void) | null = null;
      onerror: (() => void) | null = null;
      paused = true;
      currentTime = 0;
      pause() { this.paused = true; }
      play() {
        if (fails) return Promise.reject(new Error("recording unavailable"));
        this.paused = false;
        this.currentTime = 1;
        this.onplaying?.();
        return Promise.resolve();
      }
    }
    vi.stubGlobal("Audio", FakeAudio);
    const { speakWord } = await import("@/hooks/useSpeech");
    return { speakWord, speak };
  }

  it("reads the word with the device after recording playback fails, without an AI request", async () => {
    const { speakWord, speak } = await setup(true);
    speakWord("apple");
    await vi.advanceTimersByTimeAsync(100);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].text).toBe("apple");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("keeps successful recordings without starting device speech", async () => {
    const { speakWord, speak } = await setup(false);
    speakWord("pear");
    await vi.advanceTimersByTimeAsync(100);
    expect(speak).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });
});