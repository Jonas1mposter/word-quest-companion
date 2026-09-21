import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { url, subject, grade, rows: inlineRows, replace } = body;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let rows = inlineRows;
    if (!rows) {
      if (!url) throw new Error("url or rows required");
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch failed ${res.status}`);
      rows = await res.json();
    }

    const subj = subject ?? "economics";
    const gradeVal = typeof grade === "number" ? grade : 9;
    if (replace !== false) {
      let del = supabase.from("hs_words").delete().eq("subject", subj);
      del = gradeVal === 9 ? del.eq("grade", 9) : del.eq("grade", gradeVal);
      await del;
    }

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200).map((e: Record<string, unknown>) => ({
        word: e.word,
        meaning: e.pos ? `${e.pos} ${e.meaning}` : e.meaning,
        phonetic: e.phonetic || null,
        definition: e.definition || null,
        example: e.example || null,
        subject: subj,
        grade: typeof e.grade === "number" ? e.grade : gradeVal,
        unit: e.unit,
        unit_name: e.unit_name ?? `第${e.unit}关`,
        order_index: e.order_index,
      }));
      const { error } = await supabase.from("hs_words").insert(chunk);
      if (error) throw error;
      inserted += chunk.length;
    }

    return new Response(JSON.stringify({ ok: true, inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
