import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

const PREMIUM_COST = 500;

// Atomically purchase season pass premium. Validates coin balance, deducts
// coins, marks pass premium=true. Uses optimistic lock on coins.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { passId } = await req.json();
    if (typeof passId !== "string") return json({ error: "Bad request" }, 400);

    const { data: pass } = await admin
      .from("user_season_pass")
      .select("*")
      .eq("id", passId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!pass) return json({ error: "Pass not found" }, 404);
    if (pass.is_premium) return json({ error: "Already premium" }, 400);
    if (profile.coins < PREMIUM_COST) return json({ error: "Not enough coins" }, 400);

    const { error: cErr } = await admin
      .from("profiles")
      .update({ coins: profile.coins - PREMIUM_COST })
      .eq("id", profile.id)
      .eq("coins", profile.coins);
    if (cErr) return json({ error: "Concurrent update" }, 409);

    const { error: pErr } = await admin
      .from("user_season_pass")
      .update({ is_premium: true, purchased_at: new Date().toISOString() })
      .eq("id", passId);
    if (pErr) {
      // refund
      await admin.from("profiles").update({ coins: profile.coins }).eq("id", profile.id);
      return json({ error: "Upgrade failed" }, 500);
    }

    return json({ ok: true, newCoins: profile.coins - PREMIUM_COST });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
