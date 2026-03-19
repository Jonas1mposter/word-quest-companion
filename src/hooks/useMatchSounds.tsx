import { useCallback, useRef } from 'react';
import { audioManager } from '@/lib/audioManager';

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

  const playCombo = useCallback(async (comboCount: number) => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); const baseFreq = 523.25 * (1 + Math.min(comboCount,10)*0.1); [{freq:baseFreq,time:0},{freq:baseFreq*1.25,time:0.06},{freq:baseFreq*1.5,time:0.12}].forEach(({freq,time})=>{ const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='triangle'; o.frequency.setValueAtTime(freq,ctx.currentTime+time); const v=0.12+Math.min(comboCount,10)*0.01; g.gain.setValueAtTime(0,ctx.currentTime+time); g.gain.linearRampToValueAtTime(v,ctx.currentTime+time+0.02); g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+time+0.15); o.start(ctx.currentTime+time); o.stop(ctx.currentTime+time+0.15); }); } catch(e) {}
  }, [ensureAudioReady]);

  const playUrgent = useCallback(async () => {
    if (!isEnabledRef.current) return;
    try { const ctx = await ensureAudioReady(); const o=ctx.createOscillator(); const g=ctx.createGain(); o.connect(g); g.connect(ctx.destination); o.type='square'; o.frequency.setValueAtTime(600,ctx.currentTime); g.gain.setValueAtTime(0.1,ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.01,ctx.currentTime+0.1); o.start(ctx.currentTime); o.stop(ctx.currentTime+0.1); } catch(e) {}
  }, [ensureAudioReady]);

  const toggleSounds = useCallback((enabled: boolean) => { isEnabledRef.current = enabled; }, []);
  const unlockAudio = useCallback(async () => { await audioManager.ensureReady(); }, []);

  return { playSearchingBeep, playMatchFound, playCorrect, playWrong, playVictory, playDefeat, playTick, playUrgent, playCombo, toggleSounds, unlockAudio };
};
