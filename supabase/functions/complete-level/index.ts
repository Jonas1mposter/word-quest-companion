import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

// Atomically award XP/coins/energy-cost for completing a learning level.
// First-wave hardening: server computes XP/coins from accuracy, deducts energy,
// updates level_progress and combo records. Per-word learning_progress is still
// written client-side (low forgery value) and reconciled here from the cache.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const body = await req.json();
    const {
      levelId,
      levelName,
      totalWords,
      correctCount,
      maxCombo = 0,
      isLetterLevel = false,
    } = body ?? {};

    if (
      typeof levelId !== "string" ||
      typeof totalWords !== "number" || totalWords <= 0 || totalWords > 50 ||
      typeof correctCount !== "number" || correctCount < 0 || correctCount > totalWords
    ) {
      return json({ error: "Bad request" }, 400);
    }
    if (profile.energy < 1) return json({ error: "Not enough energy" }, 400);

    const accuracy = correctCount / totalWords;
    const baseXp = 5;
    const bonusXp = Math.floor(accuracy * 5);
    const baseCoins = 2;
    const bonusCoins = accuracy === 1 ? 3 : Math.floor(accuracy * 2);
    const xpGained = baseXp + bonusXp;
    const coinsGained = baseCoins + bonusCoins;
    const stars = accuracy >= 0.9 ? 3 : accuracy >= 0.7 ? 2 : accuracy >= 0.5 ? 1 : 0;

    // Level-up math (matches src/lib/levelUp.ts).
    let newXp = profile.xp + xpGained;
    let newLevel = profile.level;
    let newXpToNext = profile.xp_to_next_level;
    let leveledUp = false;
    while (newXp >= newXpToNext) {
      newXp -= newXpToNext;
      newLevel++;
      leveledUp = true;
      newXpToNext = 100 * newLevel;
    }

    const patch: Record<string, any> = {
      xp: newXp,
      level: newLevel,
      xp_to_next_level: newXpToNext,
      total_xp: (profile.total_xp ?? 0) + xpGained,
      coins: profile.coins + coinsGained,
      energy: profile.energy - 1,
    };
    if (maxCombo > (profile.max_combo ?? 0)) patch.max_combo = maxCombo;

    // Optimistic lock on energy to prevent double-spend.
    const { error: upErr } = await admin
      .from("profiles")
      .update(patch)
      .eq("id", profile.id)
      .eq("energy", profile.energy);
    if (upErr) return json({ error: "Concurrent update, retry" }, 409);

    // level_progress (only for non-letter levels)
    if (!isLetterLevel) {
      const { data: existing } = await admin
        .from("level_progress")
        .select("*")
        .eq("profile_id", profile.id)
        .eq("level_id", levelId)
        .maybeSingle();

      const score = Math.round(accuracy * 100);
      if (existing) {
        await admin
          .from("level_progress")
          .update({
            status: "completed",
            stars: Math.max(existing.stars, stars),
            best_score: Math.max(existing.best_score, score),
            attempts: existing.attempts + 1,
            completed_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await admin.from("level_progress").insert({
          profile_id: profile.id,
          level_id: levelId,
          status: "completed",
          stars,
          best_score: score,
          attempts: 1,
          completed_at: new Date().toISOString(),
        });
      }
    }

    // Combo record
    if (maxCombo >= 3) {
      await admin.from("combo_records").insert({
        profile_id: profile.id,
        combo_count: maxCombo,
        mode: "learning",
        level_name: levelName ?? null,
      });
    }

    // 自动判定徽章解锁
    await admin.rpc("award_badges_for_profile", { p_id: profile.id });


    return json({
      ok: true,
      xpGained,
      coinsGained,
      stars,
      leveledUp,
      newLevel,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
