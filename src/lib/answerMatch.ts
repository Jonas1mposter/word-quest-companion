// 拼写判定：宽松匹配括号、斜杠、大小写、空格、连字符和引号。
// 同一份逻辑复制在 supabase/functions/_shared/answerMatch.ts，修改时两边保持一致。
const clean = (s: string) =>
  s.toLowerCase()
    .replace(/[（]/g, "(").replace(/[）]/g, ")")
    .replace(/[’‘`]/g, "'")
    .replace(/[-‐–—_]/g, " ")
    .replace(/[.,;:!?]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function acceptedAnswers(target: string): string[] {
  const base = clean(String(target ?? ""));
  const out = new Set<string>([base]);
  const parts = base.split(/\s*\/\s*/).filter(Boolean); // tyres / tires
  for (const p of parts) {
    out.add(p);
    const noParen = p.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
    if (noParen) out.add(noParen);
    const inParen = p.replace(/[()]/g, " ").replace(/\s+/g, " ").trim(); // 去掉括号符号但保留内容
    if (inParen) out.add(inParen);
  }
  // 括号里是缩写（DWL、kJ、°C，含大写或符号）时只打缩写也算对；说明性括号（trig）不算
  for (const m of String(target ?? "").matchAll(/[(（]([^)）]+)[)）]/g)) {
    const a = m[1].trim();
    if (/^[A-Za-z°µ]{1,6}$/.test(a) && /[A-Z°µ]/.test(a)) out.add(clean(a));
  }
  return [...out].filter(Boolean);
}

export function isAnswerCorrect(input: string, target: string): boolean {
  const a = clean(String(input ?? ""));
  if (!a) return false;
  const accepted = acceptedAnswers(target);
  return accepted.includes(a) || accepted.map((x) => x.replace(/ /g, "")).includes(a.replace(/ /g, ""));
}
