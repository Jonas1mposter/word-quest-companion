import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { audioManager } from '@/lib/audioManager';
import { supabase } from '@/integrations/supabase/client';
import kill1 from '@/assets/kill-sounds/kill_1.mp3.asset.json';
import kill2 from '@/assets/kill-sounds/kill_2.mp3.asset.json';
import kill3 from '@/assets/kill-sounds/kill_3.mp3.asset.json';
import kill4 from '@/assets/kill-sounds/kill_4.mp3.asset.json';
import kill5 from '@/assets/kill-sounds/kill_5.mp3.asset.json';

const DEFAULT_URLS = [kill1.url, kill2.url, kill3.url, kill4.url, kill5.url];
const VARIANT_STORAGE_KEY = 'kill-sound-variant';

let activeUrls: string[] = [...DEFAULT_URLS];
let activeVariants: Record<string, string[]> | null = null;
let activeVariantKey: string | null = null;
let activeVariantIcons: Record<string, string[]> | null = null;
let activeLoaded = false;
let activeLoadingPromise: Promise<void> | null = null;

const killAudioCache: Record<number, HTMLAudioElement> = {};
const clearKillCache = () => Object.keys(killAudioCache).forEach((k) => delete killAudioCache[Number(k)]);

const storedVariantKey = (): string | null => {
  try { return localStorage.getItem(VARIANT_STORAGE_KEY); } catch { return null; }
};

const pickVariantUrls = (variants: Record<string, string[]>): string[] => {
  const keys = Object.keys(variants);
  const wanted = storedVariantKey();
  const key = wanted && variants[wanted]?.length ? wanted : keys[0];
  activeVariantKey = key;
  return variants[key];
};

const loadActivePack = (): Promise<void> => {
  if (activeLoaded) return Promise.resolve();
  if (activeLoadingPromise) return activeLoadingPromise;
  activeLoadingPromise = (async () => {
    try {
      const { data: u, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!u?.user) return;
      const { data: prof, error: profileError } = await supabase
        .from('profiles')
        .select('active_kill_sound_pack_id')
        .eq('user_id', u.user.id)
        .maybeSingle();
      if (profileError || !prof) throw profileError ?? new Error('Sound profile unavailable');
      if (!prof.active_kill_sound_pack_id) {
        activeUrls = [...DEFAULT_URLS]; activeVariants = null; activeVariantKey = null;
        activeVariantIcons = null; clearKillCache(); activeLoaded = true;
        return;
      }
      const { data: pack, error: packError } = await supabase
        .from('kill_sound_packs')
        .select('sound_urls, variant_urls, variant_icon_urls')
        .eq('id', prof.active_kill_sound_pack_id)
        .maybeSingle();
      if (packError || !pack) throw packError ?? new Error('Equipped sound pack unavailable');
      const variants = pack?.variant_urls as unknown as Record<string, string[]> | null;
      const urls = pack?.sound_urls as unknown as string[] | undefined;
      if (variants && typeof variants === 'object' && !Array.isArray(variants) && Object.keys(variants).length > 1) {
        activeVariants = variants;
        activeVariantIcons = ((pack as any)?.variant_icon_urls as Record<string, string[]> | null) ?? null;
        activeUrls = pickVariantUrls(variants);
        clearKillCache();
      } else if (Array.isArray(urls) && urls.length >= 5) {
        activeVariants = null;
        activeVariantKey = null;
        activeVariantIcons = null;
        activeUrls = urls;
        clearKillCache();
      } else throw new Error('Equipped sound pack has no usable audio');
      activeLoaded = true;
    } catch { console.warn('Equipped sound pack loading failed; will retry'); }
    finally { notifyVariantListeners(); }
  })();
  void activeLoadingPromise.finally(() => { activeLoadingPromise = null; });
  return activeLoadingPromise;
};

export const reloadActiveSoundPack = () => {
  activeLoaded = false;
  activeVariantIcons = null;
  activeLoadingPromise = null;
  clearKillCache();
  return loadActivePack();
};

// ---- 局内变体切换（如 ORA X 颗秒的 5 套音效） ----
const variantListeners = new Set<() => void>();
const notifyVariantListeners = () => variantListeners.forEach((l) => l());

// 必须返回稳定引用，否则 useSyncExternalStore 会无限重渲染导致黑屏
let variantSnapshot: { variants: typeof activeVariants; selected: string | null; icons: Record<string, string[]> | null } = { variants: null, selected: null, icons: null };
export const getSoundVariantState = () => {
  if (variantSnapshot.variants !== activeVariants || variantSnapshot.selected !== activeVariantKey || variantSnapshot.icons !== activeVariantIcons) {
    variantSnapshot = { variants: activeVariants, selected: activeVariantKey, icons: activeVariantIcons };
  }
  return variantSnapshot;
};

export const setSoundVariant = (key: string) => {
  if (!activeVariants?.[key]?.length) return;
  activeVariantKey = key;
  activeUrls = activeVariants[key];
  clearKillCache();
  try { localStorage.setItem(VARIANT_STORAGE_KEY, key); } catch { /* ignore */ }
  notifyVariantListeners();
};

export const useSoundVariants = () =>
  useSyncExternalStore(
    (cb) => { variantListeners.add(cb); return () => { variantListeners.delete(cb); }; },
    getSoundVariantState,
    getSoundVariantState,
  );

const getKillAudio = (n: number) => {
  const max = activeUrls.length;
  const idx = Math.min(Math.max(n, 1), max) - 1;
  if (!killAudioCache[idx]) {
    const a = new Audio(activeUrls[idx]);
    a.preload = 'auto';
    killAudioCache[idx] = a;
  }
  return killAudioCache[idx];
};

export const useMatchSounds = () => {
  const isEnabledRef = useRef(true);

  useEffect(() => { loadActivePack(); }, []);

  const ensureAudioReady = useCallback(async () => audioManager.ensureReady(), []);

  const playSearchingBeep = useCallback(async () => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); const o = ctx.createOscillator(); const g = ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.setValueAtTime(400,ctx.currentTime); o.frequency.exponentialRampToValueAtTime(600,ctx.currentTime+0.1); g.gain.setValueAtTime(0.1,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.15); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.15); } catch(e) { console.log('Sound failed:',e); }
  }, [ensureAudioReady]);

  const playMatchFound = useCallback(async () => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); [523.25,659.25,783.99,1046.50].forEach((freq,i) => { const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.setValueAtTime(freq,ctx.currentTime); const t=ctx.currentTime+i*0.08; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.15,t+0.02); g.gain.exponentialRampToValueAtTime(0.01,t+0.15); o.start(t); o.stop(t+0.15); }); } catch(e) {}
  }, [ensureAudioReady]);

  const playCorrect = useCallback(async () => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.setValueAtTime(523.25,ctx.currentTime); o.frequency.setValueAtTime(659.25,ctx.currentTime+0.1); g.gain.setValueAtTime(0.15,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.25); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.25); } catch(e) {}
  }, [ensureAudioReady]);

  const playWrong = useCallback(async () => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sawtooth'; o.frequency.setValueAtTime(200,ctx.currentTime); o.frequency.exponentialRampToValueAtTime(100,ctx.currentTime+0.2); g.gain.setValueAtTime(0.1,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.2); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.2); } catch(e) {}
  }, [ensureAudioReady]);

  const playVictory = useCallback(async () => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); [{freq:523.25,time:0},{freq:659.25,time:0.12},{freq:783.99,time:0.24},{freq:1046.50,time:0.36},{freq:1318.51,time:0.48}].forEach(({freq,time})=>{ const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.setValueAtTime(freq,ctx.currentTime+time); g.gain.setValueAtTime(0,ctx.currentTime+time); g.gain.linearRampToValueAtTime(0.2,ctx.currentTime+time+0.02); g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+time+0.3); o.start(ctx.currentTime+time); o.stop(ctx.currentTime+time+0.3); }); } catch(e) {}
  }, [ensureAudioReady]);

  const playDefeat = useCallback(async () => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); [{freq:392,time:0},{freq:349.23,time:0.15},{freq:293.66,time:0.3}].forEach(({freq,time})=>{ const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.setValueAtTime(freq,ctx.currentTime+time); g.gain.setValueAtTime(0,ctx.currentTime+time); g.gain.linearRampToValueAtTime(0.12,ctx.currentTime+time+0.02); g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+time+0.3); o.start(ctx.currentTime+time); o.stop(ctx.currentTime+time+0.3); }); } catch(e) {}
  }, [ensureAudioReady]);

  const playTick = useCallback(async () => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='sine'; o.frequency.setValueAtTime(880,ctx.currentTime); g.gain.setValueAtTime(0.08,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.08); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.08); } catch(e) {}
  }, [ensureAudioReady]);


  // 按装备包的实际段数播放；六段包在6连击及以上使用第六段。
  const playCombo = useCallback(async (comboCount: number) => {
    if (!isEnabledRef.current) return;
    const contextReady = ensureAudioReady().catch(() => null);
    try {
      await loadActivePack();
      const audio = getKillAudio(comboCount);
      audio.currentTime = 0;
      try { await audio.play(); }
      catch {
        // Async grading may lose HTML media user activation (notably Safari).
        // Use the context unlocked on the player's answer click as a fallback.
        const ctx = await contextReady;
        if (!ctx || ctx.state === 'suspended') throw new Error('Combo audio context unavailable');
        const response = await fetch(audio.src);
        if (!response.ok) throw new Error('Combo audio download failed');
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        const source = ctx.createBufferSource();
        source.buffer = buffer; source.connect(ctx.destination); source.start();
      }
    } catch { console.warn('Combo audio playback failed'); }
  }, [ensureAudioReady]);

  const playUrgent = useCallback(async () => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='square'; o.frequency.setValueAtTime(600,ctx.currentTime); g.gain.setValueAtTime(0.1,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.1); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.1); } catch(e) {}
  }, [ensureAudioReady]);

  const toggleSounds = useCallback((enabled: boolean) => { isEnabledRef.current = enabled; }, []);
  const unlockAudio = useCallback(async () => { await audioManager.ensureReady(); }, []);

  return { playSearchingBeep, playMatchFound, playCorrect, playWrong, playVictory, playDefeat, playTick, playUrgent, playCombo, toggleSounds, unlockAudio };
};
