import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";
import { learningEnergyCost, MAX_LEARNING_WORDS } from "../_shared/learningReward.ts";

// Opens a server-timed learning-level session. complete-level only pays out
// against an unused session that has existed long enough to be played.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const body = await req.json().catch(() => ({}));
    const { levelId, totalWords } = body ?? {};
    if (
      typeof levelId !== "string" || levelId.length > 100 ||
      typeof totalWords !== "number" || !Number.isInteger(totalWords) ||
      totalWords <= 0 || totalWords > MAX_LEARNING_WORDS
    ) {
      return json({ error: "Bad request" }, 400);
    }
    if (profile.energy < learningEnergyCost(totalWords)) return json({ error: "Not enough energy" }, 400);

    // Limit open sessions to curb session farming.
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("level_sessions")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .gte("started_at", since);
    if ((count ?? 0) >= 60) return json({ error: "Too many sessions" }, 429);

    const { data, error } = await admin
      .from("level_sessions")
      .insert({ profile_id: profile.id, level_id: levelId, total_words: totalWords })
      .select("id")
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ sessionId: data.id });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
