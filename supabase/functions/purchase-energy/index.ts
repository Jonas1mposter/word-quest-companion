import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

const PACKAGES: Record<string, { energy: number; cost: number }> = {
  "1": { energy: 1, cost: 10 },
  "3": { energy: 3, cost: 25 },
  "5": { energy: 5, cost: 40 },
  "10": { energy: 10, cost: 70 },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { packageId } = await req.json();
    const pkg = PACKAGES[String(packageId)];
    if (!pkg) return json({ error: "Invalid package" }, 400);

    if (profile.coins < pkg.cost) {
      return json({ error: "Not enough coins" }, 400);
    }

    const newCoins = profile.coins - pkg.cost;
    const newEnergy = profile.energy + pkg.energy;

    // Optimistic-locked update: only succeeds if coins haven't changed.
    const { data, error } = await admin
      .from("profiles")
      .update({ coins: newCoins, energy: newEnergy })
      .eq("id", profile.id)
      .eq("coins", profile.coins)
      .select("coins, energy")
      .single();

    if (error || !data) return json({ error: "Concurrent update, retry" }, 409);
    return json({ ok: true, coins: data.coins, energy: data.energy });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
