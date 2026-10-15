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
