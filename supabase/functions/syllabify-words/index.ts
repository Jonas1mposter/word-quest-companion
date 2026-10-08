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
    const body = await req.json().catch(() => ({}));
    const W = body.workers || 1, me = body.worker || 0;
    const hash = (w: string) => [...w].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const mine = todo.filter((w) => hash(w) % W === me);
    const batch = mine.slice(0, 60);
    if (!batch.length) return new Response(JSON.stringify({ remaining: 0 }), { headers: cors });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY")!, "X-Lovable-AIG-SDK": "fetch", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions: "You split English words into dictionary syllables (Merriam-Webster style), using '·' between syllables, e.g. vocabulary -> vo·cab·u·lar·y, abandon -> a·ban·don, economics -> ec·o·nom·ics. One-syllable words stay unchanged. For phrases, split each word and keep spaces. Keep the original letters, case, hyphens and punctuation exactly; only insert '·'. Return one item per input word.",
        input: JSON.stringify(batch),
        text: { format: { type: "json_schema", name: "syllables", strict: true, schema: {
          type: "object", additionalProperties: false, required: ["items"],
          properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["word", "syllables"],
            properties: { word: { type: "string" }, syllables: { type: "string" } } } } },
        } } },
      }),
    });
    if (!res.ok || !res.body) throw new Error(`AI ${res.status} ${await res.text()}`);
    let txt = "", buf = "";
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      const lines = buf.split("\n"); buf = lines.pop()!;
      for (const l of lines) {
        if (!l.startsWith("data:")) continue;
        try { const ev = JSON.parse(l.slice(5)); if (ev.type === "response.output_text.delta") txt += ev.delta; } catch { /* skip */ }
      }
    }
    const map: Record<string, string> = {};
    (JSON.parse(txt).items as { word: string; syllables: string }[]).forEach((i) => (map[i.word] = i.syllables));
    const rows = batch.map((w) => {
      const s = typeof map[w] === "string" ? map[w] : w;
      // safety: letters must be unchanged
      return { word: w, syllables: s.replace(/·/g, "") === w ? s : w };
    });
    const { error } = await sb.from("word_syllables").upsert(rows);
    if (error) throw error;
    return new Response(JSON.stringify({ remaining: mine.length - batch.length, sample: rows.slice(0, 5) }), { headers: cors });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});
