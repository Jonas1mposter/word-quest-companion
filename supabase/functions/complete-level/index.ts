import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";
import { coinMultiplier } from "../_shared/weekend.ts";
import { learningCoinReward, learningEnergyCost, MAX_LEARNING_WORDS } from "../_shared/learningReward.ts";

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
      durationMs,
    } = body ?? {};

    if (
      typeof levelId !== "string" ||
      !Number.isInteger(totalWords) || totalWords <= 0 || totalWords > MAX_LEARNING_WORDS ||
      !Number.isInteger(correctCount) || correctCount < 0 || correctCount > totalWords
    ) {
      return json({ error: "Bad request" }, 400);
    }
    const energyCost = learningEnergyCost(totalWords);
    if (profile.energy < energyCost) return json({ error: "Not enough energy" }, 400);

    // ===== 服务端计时会话：必须先 start-level，且每个会话只能结算一次 =====
    const { sessionId } = body ?? {};
    if (typeof sessionId !== "string") return json({ error: "Missing session" }, 400);
    const { data: session } = await admin
      .from("level_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (!session || session.completed_at) return json({ error: "Invalid session" }, 400);
    if (session.level_id !== levelId || session.total_words !== totalWords) {
      return json({ error: "Session mismatch" }, 400);
    }
    const elapsed = Date.now() - new Date(session.started_at).getTime();
    if (elapsed > 2 * 60 * 60 * 1000) return json({ error: "Session expired" }, 400);
    const perWord = elapsed / totalWords;
    if (perWord < 1200) {
      await admin.rpc("dac_flag", {
        p_profile_id: profile.id,
        p_source: "complete-level",
        p_reason: "impossible_level_speed",
        p_severity: perWord < 600 ? "high" : "medium",
        p_meta: { levelId, levelName, totalWords, correctCount, serverElapsedMs: elapsed, clientDurationMs: durationMs ?? null, perWordMs: Math.round(perWord) },
      });
      // 低于每题 0.6 秒（服务端计时）不可能是人工作答，直接拒绝结算
      if (perWord < 600) return json({ error: "Too fast" }, 400);
    }
    // 原子占用会话，防止并发重复领取
    const { data: claimed } = await admin
      .from("level_sessions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", sessionId)
      .is("completed_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) return json({ error: "Invalid session" }, 400);

    const accuracy = correctCount / totalWords;
    const baseXp = 5;
    const bonusXp = Math.floor(accuracy * 5);
    const coinFactor = coinMultiplier();
    const xpGained = baseXp + bonusXp;
    const { coinsGained, perfectBonus } = learningCoinReward(session.total_words, correctCount, coinFactor);
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
      energy: profile.energy - energyCost,
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

    // 累计豆数 & 完美主义计数
    if (coinsGained > 0) {
      await admin.rpc("bump_lifetime_coins", { p_id: profile.id, p_amount: coinsGained });
    }
    if (accuracy === 1) {
      await admin.rpc("bump_perfect_clear", { p_id: profile.id });
    }

    // 自动判定徽章解锁
    await admin.rpc("award_badges_for_profile", { p_id: profile.id });

    // 赛季手册经验
    if (xpGained > 0) {
      await admin.rpc("add_season_pass_xp", { p_profile_id: profile.id, p_xp: xpGained });
    }



    return json({
      ok: true,
      xpGained,
      coinsGained,
      energyCost,
      perfectBonus,
      weekendBonus: coinFactor === 2,
      stars,
      leveledUp,
      newLevel,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
