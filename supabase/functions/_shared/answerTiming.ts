// DAC：答题节奏检测。人类每题用时波动很大，脚本/AI 常按固定间隔作答。
export type TimingAnswer = { answered_at: string; answer: string | null };
export type TimingVerdict = { robotic: boolean; samples: number; meanMs: number; stdMs: number; cv: number };

export const MIN_SAMPLES = 6;
export const CV_LIMIT = 0.12;
export const STD_LIMIT_MS = 120;

export function analyzeTiming(rows: TimingAnswer[]): TimingVerdict {
  const ts = rows
    .map((r) => ({ t: new Date(r.answered_at).getTime(), empty: !String(r.answer ?? "").trim() }))
    .sort((a, b) => a.t - b.t);
  const gaps: number[] = [];
  for (let i = 1; i < ts.length; i++) {
    if (ts[i].empty) continue; // 超时/空答案的间隔由计时器决定，不算
    const g = ts[i].t - ts[i - 1].t;
    if (g >= 200 && g <= 60000) gaps.push(g);
  }
  const n = gaps.length;
  if (n < MIN_SAMPLES) return { robotic: false, samples: n, meanMs: 0, stdMs: 0, cv: 1 };
  const mean = gaps.reduce((s, g) => s + g, 0) / n;
  const std = Math.sqrt(gaps.reduce((s, g) => s + (g - mean) ** 2, 0) / n);
  const cv = mean > 0 ? std / mean : 1;
  return { robotic: cv < CV_LIMIT || std < STD_LIMIT_MS, samples: n, meanMs: Math.round(mean), stdMs: Math.round(std), cv: Math.round(cv * 1000) / 1000 };
}

// DAC：疑似"拍照/查答案"。本局作答明显比本人平时慢、却几乎全对 → 记录供管理员复查（不自动判负）。
export type LookupVerdict = { suspicious: boolean; samples: number; accuracy: number; meanMs: number; baselineMs: number; ratio: number };
export const LOOKUP_MIN_SAMPLES = 8;
export const LOOKUP_MIN_ACCURACY = 0.9;
export const LOOKUP_MIN_MEAN_MS = 6000;
export const LOOKUP_RATIO = 2.5;
export const BASELINE_MIN_SAMPLES = 20;

function gapsOf(rows: { answered_at: string; answer: string | null }[]) {
  const ts = rows.map((r) => ({ t: new Date(r.answered_at).getTime(), empty: !String(r.answer ?? "").trim() })).sort((a, b) => a.t - b.t);
  const g: number[] = [];
  for (let i = 1; i < ts.length; i++) {
    if (ts[i].empty) continue;
    const d = ts[i].t - ts[i - 1].t;
    if (d >= 200 && d <= 60000) g.push(d);
  }
  return g;
}

export function analyzeLookup(
  current: { answered_at: string; answer: string | null; is_correct: boolean }[],
  historyByMatch: { answered_at: string; answer: string | null }[][],
): LookupVerdict {
  const n = current.length;
  const accuracy = n ? current.filter((r) => r.is_correct).length / n : 0;
  const g = gapsOf(current);
  const meanMs = g.length ? g.reduce((s, x) => s + x, 0) / g.length : 0;
  const hist = historyByMatch.flatMap(gapsOf).sort((a, b) => a - b);
  const baselineMs = hist.length ? hist[Math.floor(hist.length / 2)] : 0; // 中位数，抗极端值
  const ratio = baselineMs > 0 ? meanMs / baselineMs : 0;
  const suspicious = n >= LOOKUP_MIN_SAMPLES && hist.length >= BASELINE_MIN_SAMPLES &&
    accuracy >= LOOKUP_MIN_ACCURACY && meanMs >= LOOKUP_MIN_MEAN_MS && ratio >= LOOKUP_RATIO;
  return { suspicious, samples: n, accuracy: Math.round(accuracy * 100) / 100, meanMs: Math.round(meanMs), baselineMs: Math.round(baselineMs), ratio: Math.round(ratio * 100) / 100 };
}
