import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

// Claim a challenge reward (class/grade). Validates ownership and
// claimed=false, then marks claimed and credits coins/xp.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { rewardId } = await req.json();
    if (typeof rewardId !== "string") return json({ error: "Bad request" }, 400);

    const { data: reward } = await admin
      .from("challenge_rewards")
      .select("*")
      .eq("id", rewardId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!reward) return json({ error: "Reward not found" }, 404);
    if (reward.claimed) return json({ error: "Already claimed" }, 400);

    const { error: claimErr } = await admin
      .from("challenge_rewards")
      .update({ claimed: true })
      .eq("id", rewardId)
      .eq("claimed", false);
    if (claimErr) return json({ error: "Claim failed" }, 409);

    const patch: Record<string, any> = {};
    if (reward.reward_type === "coins") patch.coins = profile.coins + reward.reward_value;
    else if (reward.reward_type === "xp") {
      patch.xp = profile.xp + reward.reward_value;
      patch.total_xp = (profile.total_xp ?? 0) + reward.reward_value;
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
