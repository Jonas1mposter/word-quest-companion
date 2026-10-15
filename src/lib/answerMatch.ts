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
    const abbr = p.match(/\(([^)]+)\)/g)?.map((m) => m.slice(1, -1).trim());
    // 括号里是缩写（DWL、kJ）时也算对；括号里是说明（trig、statistics）时不算
    abbr?.forEach((a) => { if (/^[a-z°µ]{1,6}$/i.test(a) && a.length <= 5) out.add(a); });
  }
  return [...out].filter(Boolean);
}

export function isAnswerCorrect(input: string, target: string): boolean {
  const a = clean(String(input ?? ""));
  if (!a) return false;
  const accepted = acceptedAnswers(target);
  return accepted.includes(a) || accepted.map((x) => x.replace(/ /g, "")).includes(a.replace(/ /g, ""));
}
