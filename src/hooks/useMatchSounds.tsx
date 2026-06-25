import { useCallback, useRef } from 'react';
import { audioManager } from '@/lib/audioManager';
import kill1 from '@/assets/kill-sounds/kill_1.mp3.asset.json';
import kill2 from '@/assets/kill-sounds/kill_2.mp3.asset.json';
import kill3 from '@/assets/kill-sounds/kill_3.mp3.asset.json';
import kill4 from '@/assets/kill-sounds/kill_4.mp3.asset.json';
import kill5 from '@/assets/kill-sounds/kill_5.mp3.asset.json';

const KILL_SOUND_URLS = [kill1.url, kill2.url, kill3.url, kill4.url, kill5.url];
const killAudioCache: Record<number, HTMLAudioElement> = {};
const getKillAudio = (n: number) => {
  const idx = Math.min(Math.max(n, 1), 5) - 1;
  if (!killAudioCache[idx]) {
    const a = new Audio(KILL_SOUND_URLS[idx]);
    a.preload = 'auto';
    killAudioCache[idx] = a;
  }
  return killAudioCache[idx];
};

export const useMatchSounds = () => {
  const isEnabledRef = useRef(true);

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

  // 《无畏契约》风格连击音效：金属脆响 + 低频冲击 + 高音叮 + 噪声 snap，连击越高音色越亮越密
  const playCombo = useCallback(async (comboCount: number) => {
    if (!isEnabledRef.current) return;
    try {
      const ctx = await ensureAudioReady();
      const now = ctx.currentTime;
      const tier = Math.min(comboCount, 10);
      const pitchBoost = 1 + tier * 0.06;

  // 击杀音效：1-5 连击对应 5 段音频，5+ 全部使用 5 连击音效
  const playCombo = useCallback(async (comboCount: number) => {
    if (!isEnabledRef.current) return;
    try {
      await ensureAudioReady();
      const audio = getKillAudio(comboCount);
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (e) {}
  }, [ensureAudioReady]);

  const playUrgent = useCallback(async () => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='square'; o.frequency.setValueAtTime(600,ctx.currentTime); g.gain.setValueAtTime(0.1,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.1); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.1); } catch(e) {}
  }, [ensureAudioReady]);

  const toggleSounds = useCallback((enabled: boolean) => { isEnabledRef.current = enabled; }, []);
  const unlockAudio = useCallback(async () => { await audioManager.ensureReady(); }, []);

  return { playSearchingBeep, playMatchFound, playCorrect, playWrong, playVictory, playDefeat, playTick, playUrgent, playCombo, toggleSounds, unlockAudio };
};
