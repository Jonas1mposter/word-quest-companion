import { CSSProperties } from "react";

/** Decorative rarity effects layered inside a `.nc-card` container. */
const BORDER: Record<string, string> = {
  legendary: "conic-gradient(from 0deg, #fff6c2, #f59e0b, #fde68a, #b45309, #fff6c2)",
  mythology: "conic-gradient(from 0deg, #ff1f1f, #ffb3b3, #7f0000, #ff6a00, #ff1f1f)",
  hidden: "conic-gradient(from 0deg, #f43f5e, #f59e0b, #22c55e, #06b6d4, #8b5cf6, #f43f5e)",
};
const PARTICLE: Record<string, string> = {
  epic: "#f0abfc",
  legendary: "#fde68a",
  mythology: "#ff6a4d",
  hidden: "#a5f3fc",
};
export const RARITY_GLOW: Record<string, string> = {
  common: "hsl(215 16% 60% / .35)",
  rare: "hsl(199 89% 60% / .55)",
  epic: "hsl(292 84% 65% / .6)",
  legendary: "hsl(43 96% 58% / .75)",
  mythology: "hsl(0 90% 55% / .8)",
  hidden: "hsl(190 90% 60% / .7)",
};

export function nameCardFxClass(rarity?: string) {
  const r = rarity || "common";
  return ["nc-card", r !== "common" && "nc-sheen", ["legendary", "hidden"].includes(r) && "nc-glow", r === "mythology" && "nc-myth"]
    .filter(Boolean)
    .join(" ");
}

export function nameCardFxStyle(rarity?: string): CSSProperties {
  return { ["--nc-glow" as any]: RARITY_GLOW[rarity || "common"] ?? RARITY_GLOW.common };
}

export default function NameCardFx({ rarity, background }: { rarity?: string; background?: string }) {
  const r = rarity || "common";
  const border = BORDER[r];
  const pColor = PARTICLE[r];
  const count = r === "epic" ? 5 : r === "common" || r === "rare" ? 0 : r === "mythology" ? 18 : r === "legendary" ? 12 : 9;
  const stars = r === "mythology" ? 6 : r === "legendary" ? 4 : 0;
  return (
    <>
      {border && (
        <>
          <span className="nc-border" style={{ background: border }} aria-hidden />
          <span className="nc-border-inner" style={{ background }} aria-hidden />
        </>
      )}
      {r === "mythology" && <span className="nc-flame" aria-hidden />}
      {r === "mythology" && <span className="nc-border nc-border-rev" style={{ background: "conic-gradient(from 90deg, transparent, #ffd54f, transparent 35%, #ff1744, transparent 70%)" }} aria-hidden />}
      {r === "mythology" && border && <span className="nc-border-inner" style={{ background }} aria-hidden />}
      <span className="nc-pattern" aria-hidden />
      {r === "mythology" && <span className="nc-bolt" aria-hidden />}
      {Array.from({ length: stars }).map((_, i) => (
        <span key={`s${i}`} className="nc-star" aria-hidden
          style={{ left: `${8 + ((i * 41) % 84)}%`, top: `${12 + ((i * 29) % 70)}%`, animationDelay: `${(i * 0.45) % 2.2}s`,
            ["--nc-star" as any]: r === "mythology" ? "#ffb199" : "#fde68a" }} />
      ))}
      {r !== "common" && r !== "rare" && <span className="nc-holo" aria-hidden />}
      {pColor &&
        Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className="nc-particle"
            aria-hidden
            style={{
              left: `${(i * 97) % 100}%`,
              background: pColor,
              boxShadow: `0 0 6px ${pColor}`,
              animationDelay: `${(i * 0.37) % 2.8}s`,
            }}
          />
        ))}
    </>
  );
}
