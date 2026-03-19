type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';
const PATTERNS: Record<HapticPattern, number | number[]> = {
  light: 10, medium: 25, heavy: 50,
  success: [10, 50, 20], warning: [30, 50, 30, 50, 30], error: [50, 100, 50],
};
class HapticsManager {
  private enabled = true;
  private isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
  setEnabled(enabled: boolean) { this.enabled = enabled; }
  get available() { return this.isSupported && this.enabled; }
  trigger(pattern: HapticPattern = 'medium') {
    if (!this.available) return;
    try { navigator.vibrate(PATTERNS[pattern]); } catch {}
  }
  success() { this.trigger('success'); }
  error() { this.trigger('error'); }
  warning() { this.trigger('warning'); }
  light() { this.trigger('light'); }
  medium() { this.trigger('medium'); }
  heavy() { this.trigger('heavy'); }
}
export const haptics = new HapticsManager();
