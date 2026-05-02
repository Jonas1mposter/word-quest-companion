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

    const url = Deno.env.get("SUPABASE_URL")!;
    const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ak = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(url, ak, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });

    const { milestoneId } = await req.json();
    if (!milestoneId) return new Response(JSON.stringify({ error: "missing milestoneId" }), { status: 400, headers: corsHeaders });

    const admin = createClient(url, sk);
    const { data: profile } = await admin.from("profiles")
      .select("id, coins, energy, max_energy").eq("user_id", user.id).single();
    if (!profile) return new Response(JSON.stringify({ error: "no profile" }), { status: 404, headers: corsHeaders });

    const { data: progress } = await admin.from("user_season_milestones")
      .select("*").eq("profile_id", profile.id).eq("milestone_id", milestoneId).single();
    if (!progress?.completed || progress.claimed) {
      return new Response(JSON.stringify({ error: "not claimable" }), { status: 400, headers: corsHeaders });
    }

    const { data: milestone } = await admin.from("season_milestones")
      .select("reward_type, reward_value").eq("id", milestoneId).single();
    if (!milestone) return new Response(JSON.stringify({ error: "milestone not found" }), { status: 404, headers: corsHeaders });

    await admin.from("user_season_milestones")
      .update({ claimed: true, claimed_at: new Date().toISOString() })
      .eq("profile_id", profile.id).eq("milestone_id", milestoneId);

    if (milestone.reward_type === "coins") {
      await admin.from("profiles").update({ coins: profile.coins + milestone.reward_value }).eq("id", profile.id);
    } else if (milestone.reward_type === "energy") {
      await admin.from("profiles").update({ energy: Math.min(profile.energy + milestone.reward_value, profile.max_energy) }).eq("id", profile.id);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
