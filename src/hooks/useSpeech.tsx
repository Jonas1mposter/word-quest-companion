import { useCallback, useEffect, useState } from "react";

export type SpeechSpeed = "slow" | "normal" | "fast";

const SPEED_RATES: Record<SpeechSpeed, number> = {
  slow: 0.6,
  normal: 0.85,
  fast: 1.1,
};

const SPEECH_SPEED_KEY = "speech_speed_preference";

const canUseLocalStorage = () => {
  if (typeof window === "undefined") return false;

  try {
    const testKey = "__speech_storage_test__";
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
};

const getSpeechSynthesisSafe = (): SpeechSynthesis | null => {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis ?? null;
};

const canSpeak = () => {
  return !!getSpeechSynthesisSafe() && typeof window !== "undefined" && "SpeechSynthesisUtterance" in window;
};

export const getSavedSpeed = (): SpeechSpeed => {
  if (!canUseLocalStorage()) return "normal";

  const saved = window.localStorage.getItem(SPEECH_SPEED_KEY);
  if (saved === "slow" || saved === "normal" || saved === "fast") return saved;
  return "normal";
};

export const saveSpeed = (speed: SpeechSpeed) => {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(SPEECH_SPEED_KEY, speed);
};

export const useSpeech = () => {
  const [preferredVoice, setPreferredVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [speed, setSpeed] = useState<SpeechSpeed>(getSavedSpeed);

  useEffect(() => {
    const synthesis = getSpeechSynthesisSafe();
    if (!synthesis) return;

    const selectBestVoice = () => {
      const voices = synthesis.getVoices();
      if (voices.length === 0) return;

      const preferredVoiceNames = [
        "Google US English",
        "Google UK English Female",
        "Google UK English Male",
        "Microsoft Zira - English (United States)",
        "Samantha",
        "Alex",
        "Daniel",
        "Karen",
      ];

      for (const name of preferredVoiceNames) {
        const voice = voices.find((v) => v.name.includes(name));
        if (voice) {
          setPreferredVoice(voice);
          return;
        }
      }

      const nativeEnglishVoice = voices.find((v) => v.lang.startsWith("en") && !v.localService);
      if (nativeEnglishVoice) {
        setPreferredVoice(nativeEnglishVoice);
        return;
      }

      const anyEnglishVoice = voices.find((v) => v.lang.startsWith("en"));
      if (anyEnglishVoice) setPreferredVoice(anyEnglishVoice);
    };

    selectBestVoice();
    synthesis.addEventListener("voiceschanged", selectBestVoice);
    return () => synthesis.removeEventListener("voiceschanged", selectBestVoice);
  }, []);

  const changeSpeed = useCallback((newSpeed: SpeechSpeed) => {
    setSpeed(newSpeed);
    saveSpeed(newSpeed);
  }, []);

  const speak = useCallback((text: string, overrideRate?: number) => {
    const synthesis = getSpeechSynthesisSafe();
    if (!synthesis || !canSpeak()) return;

    synthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = overrideRate ?? SPEED_RATES[speed];
    utterance.pitch = 1;
    if (preferredVoice) utterance.voice = preferredVoice;
    synthesis.speak(utterance);
  }, [preferredVoice, speed]);

  return { speak, preferredVoice, speed, changeSpeed, isSpeechSupported: canSpeak() };
};

let cachedVoice: SpeechSynthesisVoice | null = null;
const initVoice = () => {
  const synthesis = getSpeechSynthesisSafe();
  if (!synthesis) return;

  const voices = synthesis.getVoices();
  if (voices.length === 0) return;

  const names = ["Google US English", "Google UK English Female", "Google UK English Male", "Microsoft Zira - English (United States)", "Samantha", "Alex", "Daniel"];
  for (const name of names) {
    const voice = voices.find((v) => v.name.includes(name));
    if (voice) {
      cachedVoice = voice;
      return;
    }
  }

  const native = voices.find((v) => v.lang.startsWith("en") && !v.localService);
  if (native) {
    cachedVoice = native;
    return;
  }

  const any = voices.find((v) => v.lang.startsWith("en"));
  if (any) cachedVoice = any;
};

const synthesis = getSpeechSynthesisSafe();
if (synthesis) {
  initVoice();
  synthesis.addEventListener("voiceschanged", initVoice);
}

export const speakWord = (word: string, overrideRate?: number) => {
  const synthesis = getSpeechSynthesisSafe();
  if (!synthesis || !canSpeak()) return;

  synthesis.cancel();
  const savedSpeed = getSavedSpeed();
  const rate = overrideRate ?? SPEED_RATES[savedSpeed];
  const utterance = new window.SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = rate;
  utterance.pitch = 1;
  if (cachedVoice) utterance.voice = cachedVoice;
  synthesis.speak(utterance);
};
