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

      // 1) 低频冲击 thump（kill 反馈感）
      {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination); o.type = 'sine';
        o.frequency.setValueAtTime(180, now);
        o.frequency.exponentialRampToValueAtTime(55, now + 0.18);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.35, now + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        o.start(now); o.stop(now + 0.24);
      }

      // 2) 噪声 snap（金属碎响）
      {
        const dur = 0.08;
        const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
        }
        const src = ctx.createBufferSource(); src.buffer = buffer;
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500 + tier * 200;
        const g = ctx.createGain(); g.gain.value = 0.18 + tier * 0.012;
        src.connect(hp); hp.connect(g); g.connect(ctx.destination);
        src.start(now); src.stop(now + dur);
      }

      // 3) 金属脆响 ding 双层（方波 + 三角波叠加，类似 Valorant 击杀提示）
      const dingBase = 880 * pitchBoost;
      [
        { freq: dingBase,        type: 'square'   as OscillatorType, gain: 0.10 + tier * 0.008, time: 0.012 },
        { freq: dingBase * 1.5,  type: 'triangle' as OscillatorType, gain: 0.08 + tier * 0.006, time: 0.012 },
        { freq: dingBase * 2.0,  type: 'sine'     as OscillatorType, gain: 0.06 + tier * 0.005, time: 0.02  },
      ].forEach(({ freq, type, gain, time }) => {
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, now + time);
        o.frequency.exponentialRampToValueAtTime(freq * 0.92, now + time + 0.28);
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0, now + time);
        g.gain.linearRampToValueAtTime(gain, now + time + 0.008);
        g.gain.exponentialRampToValueAtTime(0.001, now + time + 0.32);
        o.start(now + time); o.stop(now + time + 0.34);
      });

      // 4) 高连击额外加一记上扬尾音（类似 multi-kill 提示）
      if (comboCount >= 3) {
        const t2 = now + 0.18;
        const o = ctx.createOscillator(); const g = ctx.createGain();
        o.type = 'sawtooth'; o.connect(g); g.connect(ctx.destination);
        o.frequency.setValueAtTime(660 * pitchBoost, t2);
        o.frequency.exponentialRampToValueAtTime(1320 * pitchBoost, t2 + 0.22);
        g.gain.setValueAtTime(0, t2);
        g.gain.linearRampToValueAtTime(0.08 + tier * 0.006, t2 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t2 + 0.26);
        o.start(t2); o.stop(t2 + 0.28);
      }
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
