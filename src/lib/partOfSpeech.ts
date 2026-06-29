// Lightweight Chinese-meaning -> part-of-speech inference.
// Used to display POS tags next to quiz words so that multi-POS words
// (e.g. stamp = 邮票；盖章) aren't ambiguous.

export type PosTag = "n." | "v." | "adj." | "adv." | "prep." | "conj." | "pron." | "num." | "phr.";

const ADJ_SUFFIX = /的$/;
const ADV_SUFFIX = /地$/;

// Words/phrases that strongly imply a verb meaning.
const VERB_HINTS = [
  "使", "让", "把", "做", "去", "进行", "予以", "加以",
];

const PREPS = ["在", "对于", "关于", "通过", "向", "从", "为了", "由于"];
const CONJS = ["而且", "但是", "因为", "所以", "如果", "虽然"];
const PRONS = ["他", "她", "它", "我们", "你们", "他们", "自己"];

function classifySegment(seg: string): PosTag {
  const s = seg.trim();
  if (!s) return "n.";
  if (ADJ_SUFFIX.test(s)) return "adj.";
  if (ADV_SUFFIX.test(s)) return "adv.";
  if (PREPS.some((p) => s.startsWith(p))) return "prep.";
  if (CONJS.some((c) => s.startsWith(c))) return "conj.";
  if (PRONS.includes(s)) return "pron.";
  if (/^\d|^[一二三四五六七八九十百千万亿]/.test(s)) return "num.";
  if (VERB_HINTS.some((v) => s.startsWith(v))) return "v.";
  // Short 1-char Chinese verbs are common: 跑/吃/看 — but hard to be sure.
  // Default to noun, which is the most frequent case in the curriculum.
  return "n.";
}

export function inferPos(meaning: string | null | undefined): string {
  if (!meaning) return "";
  // Split on Chinese/English semicolons and slashes — each segment may carry its own POS.
  const segments = meaning
    .split(/[；;／/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segments.length) return "";

  const tags: PosTag[] = [];
  for (const seg of segments) {
    const t = classifySegment(seg);
    if (!tags.includes(t)) tags.push(t);
  }
  return tags.join("/");
}
