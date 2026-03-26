import { supabase } from "@/integrations/supabase/client";

// Seed vocabulary data for Word Quest into Supabase
const GRADE_7_WORDS = [
  { word: "abandon", meaning: "放弃；抛弃", phonetic: "/əˈbændən/", example: "He abandoned his plan." },
  { word: "ability", meaning: "能力；才能", phonetic: "/əˈbɪləti/", example: "She has the ability to learn quickly." },
  { word: "absent", meaning: "缺席的；不在的", phonetic: "/ˈæbsənt/", example: "He was absent from school." },
  { word: "absorb", meaning: "吸收；吸引", phonetic: "/əbˈzɔːrb/", example: "Plants absorb water." },
  { word: "abstract", meaning: "抽象的", phonetic: "/ˈæbstrækt/", example: "It's an abstract concept." },
  { word: "accept", meaning: "接受；认可", phonetic: "/əkˈsept/", example: "Please accept my apology." },
  { word: "access", meaning: "通道；进入", phonetic: "/ˈækses/", example: "We have access to the internet." },
  { word: "accident", meaning: "事故；意外", phonetic: "/ˈæksɪdənt/", example: "There was a car accident." },
  { word: "achieve", meaning: "实现；达到", phonetic: "/əˈtʃiːv/", example: "She achieved her goal." },
  { word: "acid", meaning: "酸；酸的", phonetic: "/ˈæsɪd/", example: "Lemon juice contains acid." },
];

let seeded = false;

export async function seedWordsIfNeeded() {
  if (seeded) return;
  seeded = true;

  // Check if words already exist
  const { count } = await supabase
    .from("words")
    .select("*", { count: "exact", head: true });

  if (count && count > 0) return;

  // Seed a small sample; full word data should be imported via admin/migration
  const words = GRADE_7_WORDS.map((w, i) => ({
    word: w.word,
    meaning: w.meaning,
    phonetic: w.phonetic,
    example: w.example,
    grade: 7,
    unit: Math.floor(i / 10) + 1,
  }));

  const { error } = await supabase.from("words").insert(words);
  if (error) {
    console.error("[SeedData] Error seeding words:", error);
  } else {
    console.log(`[SeedData] Seeded ${words.length} sample words`);
  }
}
