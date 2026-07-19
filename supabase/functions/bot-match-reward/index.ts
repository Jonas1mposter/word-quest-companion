import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { result, difficulty } = await req.json();
    if (!["win", "draw", "loss"].includes(result)) return json({ error: "Bad result" }, 400);
    const diff = ["easy", "medium", "hard"].includes(difficulty) ? difficulty : "medium";

    // 经验：胜=3 / 平=2 / 负=1
    const xpGain = result === "win" ? 3 : result === "draw" ? 2 : 1;
    // 小额狄邦豆奖励：随难度递增，仅胜利/平局
    const coinTable: Record<string, [number, number, number]> = {
      easy:   [3, 1, 0],
      medium: [5, 2, 0],
      hard:   [8, 3, 1],
    };
    const [cw, cd, cl] = coinTable[diff];
    const coinsGain = result === "win" ? cw : result === "draw" ? cd : cl;

    let newXp = (profile.xp ?? 0) + xpGain;
    let newLevel = profile.level ?? 1;
    let newXpToNext = profile.xp_to_next_level ?? 100;
    while (newXp >= newXpToNext) {
      newXp -= newXpToNext;
      newLevel++;
      newXpToNext = 100 * newLevel;
    }

    await admin.from("profiles").update({
      xp: newXp,
      level: newLevel,
      xp_to_next_level: newXpToNext,
      total_xp: (profile.total_xp ?? 0) + xpGain,
      coins: (profile.coins ?? 0) + coinsGain,
    }).eq("id", profile.id);

    if (xpGain > 0) {
      await admin.rpc("add_season_pass_xp", { p_profile_id: profile.id, p_xp: xpGain });
    }

    return json({ ok: true, xpEarned: xpGain, coinsEarned: coinsGain });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
