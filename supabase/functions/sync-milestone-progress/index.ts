import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(supabaseUrl, serviceKey);
    const { seasonId } = await req.json();
    if (!seasonId) return new Response(JSON.stringify({ error: "missing seasonId" }), { status: 400, headers: corsHeaders });

    const { data: profile } = await admin.from("profiles")
      .select("id, total_xp, wins").eq("user_id", user.id).single();
    if (!profile) return new Response(JSON.stringify({ error: "no profile" }), { status: 404, headers: corsHeaders });

    const { data: milestones } = await admin.from("season_milestones")
      .select("*").eq("season_id", seasonId).order("order_index");

    const { data: existing } = await admin.from("user_season_milestones")
      .select("*").eq("profile_id", profile.id);
    const existingMap = new Map((existing || []).map(p => [p.milestone_id, p]));

    for (const m of milestones || []) {
      let progress = 0;
      switch (m.target_type) {
        case "xp": progress = profile.total_xp || 0; break;
        case "battles": progress = profile.wins || 0; break;
        case "levels": {
          const { count } = await admin.from("level_progress")
            .select("*", { count: "exact", head: true })
            .eq("profile_id", profile.id).eq("status", "completed");
          progress = count || 0; break;
        }
        case "words": {
          const [a, b, c] = await Promise.all([
            admin.from("learning_progress").select("*", { count: "exact", head: true }).eq("profile_id", profile.id).gte("mastery_level", 1),
            admin.from("math_learning_progress").select("*", { count: "exact", head: true }).eq("profile_id", profile.id).gte("mastery_level", 1),
            admin.from("science_learning_progress").select("*", { count: "exact", head: true }).eq("profile_id", profile.id).gte("mastery_level", 1),
          ]);
          progress = (a.count || 0) + (b.count || 0) + (c.count || 0); break;
        }
        case "accuracy": {
          const { data: lp } = await admin.from("learning_progress")
            .select("correct_count, incorrect_count").eq("profile_id", profile.id);
          if (lp && lp.length >= 100) {
            const tc = lp.reduce((s, r) => s + (r.correct_count || 0), 0);
            const ta = lp.reduce((s, r) => s + (r.correct_count || 0) + (r.incorrect_count || 0), 0);
            progress = ta > 0 ? Math.round((tc / ta) * 100) : 0;
          }
          break;
        }
      }
      const completed = progress >= m.target_value;
      const prev = existingMap.get(m.id);
      await admin.from("user_season_milestones").upsert({
        profile_id: profile.id,
        milestone_id: m.id,
        progress,
        completed,
        completed_at: completed && !prev?.completed ? new Date().toISOString() : (prev?.completed_at ?? null),
      }, { onConflict: "profile_id,milestone_id" });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
