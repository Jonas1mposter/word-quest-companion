import { hyphenateSync } from "hyphen/en-us";

/** Splits an English word/phrase into syllables, e.g. vo·cab·u·lary */
export const toSyllables = (text?: string | null) =>
  text ? hyphenateSync(text, { hyphenChar: "\u00B7", minWordLength: 4 }) : "";

const SyllableWord = ({ word }: { word?: string | null }) => {
  const parts = toSyllables(word).split("\u00B7");
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
