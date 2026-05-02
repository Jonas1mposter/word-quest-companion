import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

// Atomically claim a daily quest reward. Server validates completion, marks
// claimed=true, and credits xp/coins/energy on profile. Idempotent.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { questId } = await req.json();
    if (typeof questId !== "string") return json({ error: "Bad request" }, 400);

    const { data: quest, error: qErr } = await admin
      .from("daily_quests")
      .select("*")
      .eq("id", questId)
      .eq("is_active", true)
      .maybeSingle();
    if (qErr || !quest) return json({ error: "Quest not found" }, 404);

    const today = new Date().toISOString().split("T")[0];
    const { data: prog } = await admin
      .from("user_quest_progress")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("quest_id", questId)
      .eq("quest_date", today)
      .maybeSingle();

    if (!prog || (prog.progress ?? 0) < quest.target) {
      return json({ error: "Quest not completed" }, 400);
    }
    if (prog.claimed) return json({ error: "Already claimed" }, 400);

    const { error: claimErr } = await admin
      .from("user_quest_progress")
      .update({ completed: true, claimed: true })
      .eq("id", prog.id)
      .eq("claimed", false);
    if (claimErr) return json({ error: "Claim failed" }, 409);

    const patch: Record<string, any> = {};
    if (quest.reward_type === "xp") {
      patch.xp = profile.xp + quest.reward_amount;
      patch.total_xp = (profile.total_xp ?? 0) + quest.reward_amount;
    } else if (quest.reward_type === "coins") {
      patch.coins = profile.coins + quest.reward_amount;
    } else if (quest.reward_type === "energy") {
      patch.energy = Math.min(profile.max_energy, profile.energy + quest.reward_amount);
    }
    if (Object.keys(patch).length) {
      await admin.from("profiles").update(patch).eq("id", profile.id);
    }

    return json({ ok: true, reward: { type: quest.reward_type, amount: quest.reward_amount } });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
