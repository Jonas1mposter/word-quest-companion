import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

// Claim a season pass tier reward. Validates user level >= item.level,
// premium gating, and not-yet-claimed. Awards coins/energy on profile.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { itemId } = await req.json();
    if (typeof itemId !== "string") return json({ error: "Bad request" }, 400);

    const { data: item, error: iErr } = await admin
      .from("season_pass_items")
      .select("*")
      .eq("id", itemId)
      .maybeSingle();
    if (iErr || !item) return json({ error: "Item not found" }, 404);

    const { data: pass } = await admin
      .from("user_season_pass")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("season_id", item.season_id)
      .maybeSingle();
    if (!pass) return json({ error: "No season pass" }, 400);
    if (pass.current_level < item.level) return json({ error: "Level too low" }, 400);
    if (item.is_premium && !pass.is_premium) return json({ error: "Premium required" }, 403);

    const { data: existing } = await admin
      .from("user_pass_rewards")
      .select("id")
      .eq("profile_id", profile.id)
      .eq("season_pass_item_id", itemId)
      .maybeSingle();
    if (existing) return json({ error: "Already claimed" }, 400);

    const { error: insErr } = await admin
      .from("user_pass_rewards")
      .insert({ profile_id: profile.id, season_pass_item_id: itemId });
    if (insErr) return json({ error: "Claim failed" }, 409);

    const patch: Record<string, any> = {};
    if (item.reward_type === "coins") patch.coins = profile.coins + item.reward_value;
    else if (item.reward_type === "energy") {
      patch.energy = Math.min(profile.max_energy, profile.energy + item.reward_value);
    } else if (item.reward_type === "xp") {
      patch.xp = profile.xp + item.reward_value;
      patch.total_xp = (profile.total_xp ?? 0) + item.reward_value;
    }
    if (Object.keys(patch).length) {
      await admin.from("profiles").update(patch).eq("id", profile.id);
    }

    return json({ ok: true });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
