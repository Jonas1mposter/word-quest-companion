import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const fetchAll = async (table: string) => {
      const out: string[] = [];
      for (let f = 0; ; f += 1000) {
        const { data, error } = await sb.from(table).select("word").range(f, f + 999);
        if (error) throw error;
        out.push(...(data as { word: string }[]).map((r) => r.word));
        if (data.length < 1000) break;
      }
      return out;
    };
    const all = new Set<string>();
    for (const t of ["words", "hs_words", "math_words", "science_words"]) (await fetchAll(t)).forEach((w) => w && all.add(w.trim()));
    const done = new Set(await fetchAll("word_syllables"));
    const todo = [...all].filter((w) => !done.has(w));
    const batch = todo.slice(0, 120);
    if (!batch.length) return new Response(JSON.stringify({ remaining: 0 }), { headers: cors });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You split English words into dictionary syllables (Merriam-Webster style), using '·' between syllables, e.g. vocabulary -> vo·cab·u·lar·y, abandon -> a·ban·don, economics -> ec·o·nom·ics. One-syllable words stay unchanged. For phrases, split each word and keep spaces. Keep the original letters, case, hyphens and punctuation exactly; only insert '·'. Reply ONLY with a JSON object mapping each input to its split." },
          { role: "user", content: JSON.stringify(batch) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`AI ${res.status} ${await res.text()}`);
    const j = await res.json();
    let txt: string = j.choices[0].message.content.trim().replace(/^```json|```$/g, "");
    const map = JSON.parse(txt) as Record<string, string>;
    const rows = batch.map((w) => {
      const s = typeof map[w] === "string" ? map[w] : w;
      // safety: letters must be unchanged
      return { word: w, syllables: s.replace(/·/g, "") === w ? s : w };
    });
    const { error } = await sb.from("word_syllables").upsert(rows);
    if (error) throw error;
    return new Response(JSON.stringify({ remaining: todo.length - batch.length, sample: rows.slice(0, 5) }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
