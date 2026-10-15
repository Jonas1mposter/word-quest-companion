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

// ====== 发音来源：有道真人发音 → AI 配音（缓存）→ 设备自带朗读 ======
export type SpeechAccent = "us" | "uk";
const ACCENT_KEY = "speech_accent_preference";
export const getSavedAccent = (): SpeechAccent => {
  if (!canUseLocalStorage()) return "us";
  return window.localStorage.getItem(ACCENT_KEY) === "uk" ? "uk" : "us";
};
export const saveAccent = (a: SpeechAccent) => {
  if (canUseLocalStorage()) window.localStorage.setItem(ACCENT_KEY, a);
};

const PLAYBACK_RATES: Record<SpeechSpeed, number> = { slow: 0.75, normal: 1, fast: 1.2 };
const aiUrlCache = new Map<string, string>();
const youdaoMissing = new Set<string>();
let currentAudio: HTMLAudioElement | null = null;
let playToken = 0;

const playUrl = (url: string, rate: number, token: number) =>
  new Promise<boolean>((resolve) => {
    if (token !== playToken) return resolve(true);
    try {
      const a = new Audio(url);
      a.playbackRate = rate;
      currentAudio = a;
      let done = false;
      const finish = (ok: boolean) => { if (!done) { done = true; resolve(ok); } };
      a.onerror = () => finish(false);
      a.onplaying = () => finish(true);
      setTimeout(() => finish(!a.paused), 4000);
      a.play().catch(() => finish(false));
    } catch { resolve(false); }
  });

const speakWithDevice = (text: string, rate: number, accent: SpeechAccent, voice: SpeechSynthesisVoice | null) => {
  const synthesis = getSpeechSynthesisSafe();
  if (!synthesis || !canSpeak()) return;
  synthesis.cancel();
  const u = new window.SpeechSynthesisUtterance(text);
  u.lang = accent === "uk" ? "en-GB" : "en-US";
  u.rate = rate;
  u.pitch = 1;
  if (voice) u.voice = voice;
  synthesis.speak(u);
};

const pronounce = async (text: string, speed: SpeechSpeed, overrideRate: number | undefined, voice: SpeechSynthesisVoice | null) => {
  const t = String(text ?? "").trim();
  if (!t) return;
  const token = ++playToken;
  try { currentAudio?.pause(); } catch { /* ignore */ }
  getSpeechSynthesisSafe()?.cancel();
  const accent = getSavedAccent();
  const rate = overrideRate !== undefined ? overrideRate / SPEED_RATES.normal : PLAYBACK_RATES[speed];
  const key = `${accent}:${t.toLowerCase()}`;

  // 1. 有道真人发音
  if (!youdaoMissing.has(key)) {
    const yd = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(t)}&type=${accent === "uk" ? 1 : 2}`;
    if (await playUrl(yd, rate, token)) return;
    youdaoMissing.add(key);
  }
  if (token !== playToken) return;

  // 2. AI 配音（服务器缓存）
  try {
    let url = aiUrlCache.get(key);
    if (!url) {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase.functions.invoke("word-tts", { body: { text: t, accent } });
      if ((data as any)?.url) { url = (data as any).url as string; aiUrlCache.set(key, url); }
    }
    if (url && (await playUrl(url, rate, token))) return;
  } catch { /* fall through */ }
  if (token !== playToken) return;

  // 3. 设备自带朗读
  speakWithDevice(t, overrideRate ?? SPEED_RATES[speed], accent, voice);
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
    void pronounce(text, speed, overrideRate, preferredVoice);
  }, [preferredVoice, speed]);

  return { speak, preferredVoice, speed, changeSpeed, isSpeechSupported: true };
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
  void pronounce(word, getSavedSpeed(), overrideRate, cachedVoice);
};
