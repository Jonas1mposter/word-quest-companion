import { useEffect, useState } from "react";
import { hyphenateSync } from "hyphen/en-us";
import { supabase } from "@/integrations/supabase/client";

const DOT = "\u00B7";
let dict: Map<string, string> | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

const loadDict = () => {
  if (dict || loading) return loading;
  loading = (async () => {
    const m = new Map<string, string>();
    for (let f = 0; ; f += 1000) {
      const { data, error } = await supabase.from("word_syllables" as any).select("word, syllables").range(f, f + 999);
      if (error || !data) break;
      (data as any[]).forEach((r) => m.set(r.word, r.syllables));
      if (data.length < 1000) break;
    }
    dict = m;
    listeners.forEach((l) => l());
  })();
  return loading;
};

/** Dictionary syllables (vo·cab·u·lar·y); falls back to pattern hyphenation */
export const toSyllables = (text?: string | null) => {
  if (!text) return "";
  const hit = dict?.get(text.trim());
  if (hit) return hit;
  return hyphenateSync(text, { hyphenChar: DOT, minWordLength: 4 });
};

const SyllableWord = ({ word }: { word?: string | null }) => {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    loadDict();
    return () => { listeners.delete(l); };
  }, []);
  const parts = toSyllables(word).split(DOT);
  return (
    <span aria-label={word ?? ""}>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 && <span className="text-primary/70 mx-[0.08em]">·</span>}
        </span>
      ))}
    </span>
  );
};

export default SyllableWord;
