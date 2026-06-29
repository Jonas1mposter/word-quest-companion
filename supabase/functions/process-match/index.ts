import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

const K = 32;
const expected = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { matchId } = await req.json();
    if (typeof matchId !== "string") return json({ error: "Bad request" }, 400);

    const { data: match } = await admin
      .from("ranked_matches")
      .select("*")
      .eq("id", matchId)
      .single();
    if (!match) return json({ error: "Match not found" }, 404);

    const isP1 = match.player1_id === profile.id;
    const isP2 = match.player2_id === profile.id;
    if (!isP1 && !isP2) return json({ error: "Not in match" }, 403);

    // Recount authoritative scores from match_answers.
    const { data: answers } = await admin
      .from("match_answers")
      .select("player_id, is_correct")
      .eq("match_id", matchId);

    let p1 = 0, p2 = 0;
    for (const a of answers ?? []) {
      if (!a.is_correct) continue;
      if (a.player_id === match.player1_id) p1++;
      else if (a.player_id === match.player2_id) p2++;
    }

    let winnerId: string | null = null;
    if (p1 > p2) winnerId = match.player1_id;
    else if (p2 > p1) winnerId = match.player2_id;

    // Idempotent finalize: only update if not yet completed.
    if (match.status !== "completed") {
      await admin
        .from("ranked_matches")
        .update({
          status: "completed",
          ended_at: new Date().toISOString(),
          winner_id: winnerId,
          player1_score: p1,
          player2_score: p2,
        })
        .eq("id", matchId)
        .neq("status", "completed");

      // Apply ELO + win/loss to both players.
      const isFree = match.match_type === "free";
      const eloField = isFree ? "elo_free" : "elo_rating";
      const winField = isFree ? "free_match_wins" : "wins";
      const lossField = isFree ? "free_match_losses" : "losses";

      const xpCols = `xp, total_xp, level, xp_to_next_level`;
      const selectCols = isFree
        ? `id, coins, ${xpCols}, ${eloField}, ${winField}, ${lossField}`
        : `id, coins, ${xpCols}, ${eloField}, ${winField}, ${lossField}, rank_tier, rank_stars, rank_points`;

      const { data: players } = await admin
        .from("profiles")
        .select(selectCols)
        .in("id", [match.player1_id, match.player2_id]);

      const byId = new Map<string, any>((players ?? []).map((p: any) => [p.id, p]));
      const p1p = byId.get(match.player1_id);
      const p2p = byId.get(match.player2_id);
      if (p1p && p2p) {
        const e1 = p1p[eloField] ?? 1000;
        const e2 = p2p[eloField] ?? 1000;
        const isDraw = winnerId === null;
        const s1 = isDraw ? 0.5 : winnerId === p1p.id ? 1 : 0;
        const s2 = isDraw ? 0.5 : winnerId === p2p.id ? 1 : 0;
        const d1 = Math.round(K * (s1 - expected(e1, e2)));
        const d2 = Math.round(K * (s2 - expected(e2, e1)));

        // 段位系统配置 - 与前端 RankDisplay 保持一致
        const TIER_ORDER = ["bronze", "silver", "gold", "platinum", "diamond", "champion"] as const;
        const STARS_TO_PROMOTE: Record<string, number> = {
          bronze: 30, silver: 40, gold: 50, platinum: 50, diamond: 60, champion: 999,
        };
        const computeRank = (
          tier: string,
          stars: number,
          points: number,
          result: 1 | 0 | 0.5,
          eloDelta: number,
        ) => {
          let t = (TIER_ORDER as readonly string[]).includes(tier) ? tier : "bronze";
          let s = stars ?? 0;
          let pts = points ?? 0;
          if (result === 0.5) return { rank_tier: t, rank_stars: s, rank_points: pts };
          if (result === 1) {
            s += 1;
            if (t === "champion") {
              pts += Math.max(1, eloDelta);
            } else if (s >= STARS_TO_PROMOTE[t]) {
              const idx = TIER_ORDER.indexOf(t as any);
              t = TIER_ORDER[Math.min(idx + 1, TIER_ORDER.length - 1)];
              s = 0;
            }
          } else {
            // 输：青铜不扣星；其他扣1星
            if (t !== "bronze") {
              s -= 1;
              if (s < 0) {
                const idx = TIER_ORDER.indexOf(t as any);
                if (idx > 0) {
                  t = TIER_ORDER[idx - 1];
                  s = Math.max(0, STARS_TO_PROMOTE[t] - 3); // 降级后保留接近晋级位置
                } else {
                  s = 0;
                }
              }
            }
            if (t === "champion") pts = Math.max(0, pts + eloDelta); // eloDelta 为负
          }
          return { rank_tier: t, rank_stars: s, rank_points: pts };
        };

        // 狄邦豆奖励：排位胜=25/负=8/平=12；自由对战胜=12/负=4/平=6
        const coinReward = (score: number) => {
          if (isFree) return score === 1 ? 12 : score === 0.5 ? 6 : 4;
          return score === 1 ? 25 : score === 0.5 ? 12 : 8;
        };
        // 经验奖励：排位胜=20/平=10/负=5；自由对战胜=30/平=15/负=10
        const xpReward = (score: number) => {
          if (isFree) return score === 1 ? 30 : score === 0.5 ? 15 : 10;
          return score === 1 ? 20 : score === 0.5 ? 10 : 5;
        };
        const updates: Promise<unknown>[] = [];
        for (const [pp, delta, score] of [[p1p, d1, s1], [p2p, d2, s2]] as const) {
          // 升级计算（与 complete-level 保持一致）
          const xpGain = xpReward(score);
          let newXp = (pp.xp ?? 0) + xpGain;
          let newLevel = pp.level ?? 1;
          let newXpToNext = pp.xp_to_next_level ?? 100;
          while (newXp >= newXpToNext) {
            newXp -= newXpToNext;
            newLevel++;
            newXpToNext = 100 * newLevel;
          }
          const patch: Record<string, any> = {
            [eloField]: Math.max(100, (pp[eloField] ?? 1000) + delta),
            coins: (pp.coins ?? 0) + coinReward(score),
            xp: newXp,
            level: newLevel,
            xp_to_next_level: newXpToNext,
            total_xp: (pp.total_xp ?? 0) + xpGain,
          };
          if (score === 1) patch[winField] = (pp[winField] ?? 0) + 1;
          else if (score === 0) patch[lossField] = (pp[lossField] ?? 0) + 1;

          if (!isFree) {
            const r = computeRank(pp.rank_tier, pp.rank_stars, pp.rank_points, score, delta);
            patch.rank_tier = r.rank_tier;
            patch.rank_stars = r.rank_stars;
            patch.rank_points = r.rank_points;
          }
          updates.push(admin.from("profiles").update(patch).eq("id", pp.id));
        }
        await Promise.all(updates);

        // 自动判定徽章解锁
        await Promise.all([
          admin.rpc("award_badges_for_profile", { p_id: p1p.id }),
          admin.rpc("award_badges_for_profile", { p_id: p2p.id }),
        ]);

        // 战队挑战赛：排位赛获胜方 +1 团队积分（自由赛不计）
        if (!isFree && winnerId) {
          await admin.rpc("increment_team_challenge_score_for_profile", {
            p_profile_id: winnerId,
          });
        }
      }
    }

    // 计算调用方的奖励（即便已结算也能返回，便于前端展示）
    const isFree = match.match_type === "free";
    const callerScore = winnerId === null ? 0.5 : winnerId === profile.id ? 1 : 0;
    const coinsEarned = isFree
      ? (callerScore === 1 ? 12 : callerScore === 0.5 ? 6 : 4)
      : (callerScore === 1 ? 25 : callerScore === 0.5 ? 12 : 8);
    const xpEarned = isFree
      ? (callerScore === 1 ? 30 : callerScore === 0.5 ? 15 : 10)
      : (callerScore === 1 ? 20 : callerScore === 0.5 ? 10 : 5);

    // 对局结束后，立即清理双方在 match_queue 中的残留记录，
    // 确保下次匹配会创建全新的排队条目，避免复用旧房间。
    await admin
      .from("match_queue")
      .delete()
      .in("profile_id", [match.player1_id, match.player2_id]);

    return json({ ok: true, winnerId, player1_score: p1, player2_score: p2, coinsEarned, xpEarned });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});

