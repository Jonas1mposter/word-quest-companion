class AudioManager {
  private audioContext: AudioContext | null = null;
  private isUnlocked = false;
  private initialized = false;
  private warmupComplete = false;
  getContext(): AudioContext {
    if (!this.audioContext) this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    return this.audioContext;
  }
  get unlocked() { return this.isUnlocked; }
  onUnlock(cb: () => void) { if (this.isUnlocked) cb(); }
  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    const handler = async () => {
      if (this.isUnlocked) return;
      try {
        const ctx = this.getContext();
        if (ctx.state === 'suspended') await ctx.resume();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf; src.connect(ctx.destination); src.start(0);
        this.isUnlocked = true;
        ['touchstart','click','keydown'].forEach(e => document.removeEventListener(e, handler, true));
      } catch {}
    };
    ['touchstart','click','keydown','pointerdown'].forEach(e => document.addEventListener(e, handler, { capture: true, passive: true }));
  }
  async ensureReady() { const ctx = this.getContext(); if (ctx.state === 'suspended') try { await ctx.resume(); } catch {}; return ctx; }
  async warmup() { this.warmupComplete = true; return true; }
  get isWarmedUp() { return this.warmupComplete; }
  destroy() { this.audioContext?.close(); this.audioContext = null; this.isUnlocked = false; this.initialized = false; }
}
export const audioManager = new AudioManager();
if (typeof window !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => audioManager.initialize()); else audioManager.initialize(); }
