import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

const K = 32;
const expected = (a: number, b: number) => 1 / (1 + Math.pow(10, (b - a) / 400));

const TIER_ORDER = ["bronze", "silver", "gold", "platinum", "diamond", "champion"] as const;
const STARS_TO_PROMOTE: Record<string, number> = {
  bronze: 30, silver: 40, gold: 50, platinum: 50, diamond: 60, champion: 999,
};
const computeRank = (
  tier: string, stars: number, points: number,
  result: 1 | 0 | 0.5, eloDelta: number,
) => {
  let t = (TIER_ORDER as readonly string[]).includes(tier) ? tier : "bronze";
  let s = stars ?? 0;
  let pts = points ?? 0;
  if (result === 0.5) return { rank_tier: t, rank_stars: s, rank_points: pts };
  if (result === 1) {
    s += 1;
    if (t === "champion") pts += Math.max(1, eloDelta);
    else if (s >= STARS_TO_PROMOTE[t]) {
      const idx = TIER_ORDER.indexOf(t as any);
      t = TIER_ORDER[Math.min(idx + 1, TIER_ORDER.length - 1)];
      s = 0;
    }
  } else {
    if (t !== "bronze") {
      s -= 1;
      if (s < 0) {
        const idx = TIER_ORDER.indexOf(t as any);
        if (idx > 0) { t = TIER_ORDER[idx - 1]; s = Math.max(0, STARS_TO_PROMOTE[t] - 3); }
        else s = 0;
      }
    }
    if (t === "champion") pts = Math.max(0, pts + eloDelta);
  }
  return { rank_tier: t, rank_stars: s, rank_points: pts };
};

const coinReward = (score: number, isFree: boolean) =>
  isFree ? (score === 1 ? 12 : score === 0.5 ? 6 : 4)
         : (score === 1 ? 25 : score === 0.5 ? 12 : 8);
const xpReward = (score: number, isFree: boolean) =>
  isFree ? (score === 1 ? 30 : score === 0.5 ? 15 : 10)
         : (score === 1 ? 20 : score === 0.5 ? 10 : 5);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { matchId } = await req.json();
    if (typeof matchId !== "string") return json({ error: "Bad request" }, 400);

    const { data: match } = await admin
      .from("ranked_matches").select("*").eq("id", matchId).single();
    if (!match) return json({ error: "Match not found" }, 404);

    const is2v2 = match.mode === "2v2";
    const memberIds: string[] = is2v2
      ? [match.player1_id, match.player2_id, match.player3_id, match.player4_id].filter(Boolean)
      : [match.player1_id, match.player2_id];
    if (!memberIds.includes(profile.id)) return json({ error: "Not in match" }, 403);

    const { data: answers } = await admin
      .from("match_answers").select("player_id, is_correct").eq("match_id", matchId);

    const isRanked = match.match_type === "ranked";
    const isFree = match.match_type === "free";

    // ====================== 2v2 BRANCH ======================
    if (is2v2) {
      const team1 = [match.player1_id, match.player3_id].filter(Boolean) as string[];
      const team2 = [match.player2_id, match.player4_id].filter(Boolean) as string[];
      let t1 = 0, t2 = 0;
      for (const a of answers ?? []) {
        const inc = a.is_correct ? 1 : (isRanked ? -1 : 0);
        if (inc === 0) continue;
        if (team1.includes(a.player_id)) t1 += inc;
        else if (team2.includes(a.player_id)) t2 += inc;
      }
      let winnerTeam: number | null = null;
      if (t1 > t2) winnerTeam = 1;
      else if (t2 > t1) winnerTeam = 2;

      if (match.status !== "completed") {
        await admin.from("ranked_matches").update({
          status: "completed",
          ended_at: new Date().toISOString(),
          team1_score: t1, team2_score: t2,
          winner_team: winnerTeam,
        }).eq("id", matchId).neq("status", "completed");

        const eloField = "elo_rating";
        const winField = "wins"; const lossField = "losses";
        const { data: players } = await admin
          .from("profiles")
          .select(`id, coins, xp, total_xp, level, xp_to_next_level, ${eloField}, ${winField}, ${lossField}, rank_tier, rank_stars, rank_points`)
          .in("id", memberIds);
        const byId = new Map<string, any>((players ?? []).map((p: any) => [p.id, p]));

        const t1Avg = team1.reduce((s, id) => s + (byId.get(id)?.[eloField] ?? 1000), 0) / Math.max(1, team1.length);
        const t2Avg = team2.reduce((s, id) => s + (byId.get(id)?.[eloField] ?? 1000), 0) / Math.max(1, team2.length);

        const updates: Promise<unknown>[] = [];
        for (const pid of memberIds) {
          const pp = byId.get(pid); if (!pp) continue;
          const onTeam1 = team1.includes(pid);
          const myAvg = onTeam1 ? t1Avg : t2Avg;
          const oppAvg = onTeam1 ? t2Avg : t1Avg;
          const score: 1 | 0 | 0.5 = winnerTeam === null ? 0.5 : (winnerTeam === (onTeam1 ? 1 : 2) ? 1 : 0);
          const delta = Math.round(K * (score - expected(myAvg, oppAvg)));

          const xpGain = xpReward(score, false);
          let newXp = (pp.xp ?? 0) + xpGain;
          let newLevel = pp.level ?? 1;
          let newXpToNext = pp.xp_to_next_level ?? 100;
          while (newXp >= newXpToNext) { newXp -= newXpToNext; newLevel++; newXpToNext = 100 * newLevel; }

          const patch: Record<string, any> = {
            [eloField]: Math.max(100, (pp[eloField] ?? 1000) + delta),
            coins: (pp.coins ?? 0) + coinReward(score, false),
            xp: newXp, level: newLevel, xp_to_next_level: newXpToNext,
            total_xp: (pp.total_xp ?? 0) + xpGain,
          };
          if (score === 1) patch[winField] = (pp[winField] ?? 0) + 1;
          else if (score === 0) patch[lossField] = (pp[lossField] ?? 0) + 1;
          const r = computeRank(pp.rank_tier, pp.rank_stars, pp.rank_points, score, delta);
          patch.rank_tier = r.rank_tier; patch.rank_stars = r.rank_stars; patch.rank_points = r.rank_points;

          updates.push(admin.from("profiles").update(patch).eq("id", pid));
          // 累计豆数
          if (patch.coins > (pp.coins ?? 0)) {
            updates.push(admin.rpc("bump_lifetime_coins", { p_id: pid, p_amount: patch.coins - (pp.coins ?? 0) }));
          }
          // 排位胜场计数
          if (score === 1) updates.push(admin.rpc("bump_ranked_win", { p_id: pid }));
        }
        await Promise.all(updates);

        // 双子星：完赛领先 20 分
        if (winnerTeam !== null) {
          const winners = winnerTeam === 1 ? team1 : team2;
          const diff = Math.abs(t1 - t2);
          if (diff >= 20) {
            await Promise.all(winners.map(id => admin.rpc("grant_special_badge", { p_id: id, p_name: "双子星" })));
          }
        }

        await Promise.all(memberIds.map(id => admin.rpc("award_badges_for_profile", { p_id: id })));

        if (winnerTeam) {
          const winners = winnerTeam === 1 ? team1 : team2;
          await Promise.all(winners.map(id =>
            admin.rpc("increment_team_challenge_score_for_profile", { p_profile_id: id })));
        }
      }

      const onTeam1 = team1.includes(profile.id);
      // re-derive winner_team for response when already completed
      const finalWinnerTeam = match.status === "completed" ? match.winner_team : (t1 > t2 ? 1 : t2 > t1 ? 2 : null);
      const callerScore: 1 | 0 | 0.5 = finalWinnerTeam === null ? 0.5
        : (finalWinnerTeam === (onTeam1 ? 1 : 2) ? 1 : 0);
      const coinsEarned = coinReward(callerScore, false);
      const xpEarned = xpReward(callerScore, false);

      await admin.from("match_queue").delete().in("profile_id", memberIds);

      return json({
        ok: true, mode: "2v2",
        winnerTeam: finalWinnerTeam,
        team1_score: match.status === "completed" ? match.team1_score : t1,
        team2_score: match.status === "completed" ? match.team2_score : t2,
        coinsEarned, xpEarned,
      });
    }

    // ====================== 1v1 BRANCH (unchanged) ======================
    let p1 = 0, p2 = 0;
    for (const a of answers ?? []) {
      const inc = a.is_correct ? 1 : (isRanked ? -1 : 0);
      if (inc === 0) continue;
      if (a.player_id === match.player1_id) p1 += inc;
      else if (a.player_id === match.player2_id) p2 += inc;
    }
    let winnerId: string | null = null;
    if (p1 > p2) winnerId = match.player1_id;
    else if (p2 > p1) winnerId = match.player2_id;

    if (match.status !== "completed") {
      await admin.from("ranked_matches").update({
        status: "completed", ended_at: new Date().toISOString(),
        winner_id: winnerId, player1_score: p1, player2_score: p2,
      }).eq("id", matchId).neq("status", "completed");

      const eloField = isFree ? "elo_free" : "elo_rating";
      const winField = isFree ? "free_match_wins" : "wins";
      const lossField = isFree ? "free_match_losses" : "losses";

      const xpCols = `xp, total_xp, level, xp_to_next_level`;
      const selectCols = isFree
        ? `id, coins, ${xpCols}, ${eloField}, ${winField}, ${lossField}`
        : `id, coins, ${xpCols}, ${eloField}, ${winField}, ${lossField}, rank_tier, rank_stars, rank_points`;

      const { data: players } = await admin.from("profiles").select(selectCols)
        .in("id", [match.player1_id, match.player2_id]);
      const byId = new Map<string, any>((players ?? []).map((p: any) => [p.id, p]));
      const p1p = byId.get(match.player1_id);
      const p2p = byId.get(match.player2_id);
      if (p1p && p2p) {
        const e1 = p1p[eloField] ?? 1000;
        const e2 = p2p[eloField] ?? 1000;
        const isDraw = winnerId === null;
        const s1: 1 | 0 | 0.5 = isDraw ? 0.5 : winnerId === p1p.id ? 1 : 0;
        const s2: 1 | 0 | 0.5 = isDraw ? 0.5 : winnerId === p2p.id ? 1 : 0;
        const d1 = Math.round(K * (s1 - expected(e1, e2)));
        const d2 = Math.round(K * (s2 - expected(e2, e1)));

        const updates: Promise<unknown>[] = [];
        for (const [pp, delta, score] of [[p1p, d1, s1], [p2p, d2, s2]] as const) {
          const xpGain = xpReward(score, isFree);
          let newXp = (pp.xp ?? 0) + xpGain;
          let newLevel = pp.level ?? 1;
          let newXpToNext = pp.xp_to_next_level ?? 100;
          while (newXp >= newXpToNext) { newXp -= newXpToNext; newLevel++; newXpToNext = 100 * newLevel; }
          const patch: Record<string, any> = {
            [eloField]: Math.max(100, (pp[eloField] ?? 1000) + delta),
            coins: (pp.coins ?? 0) + coinReward(score, isFree),
            xp: newXp, level: newLevel, xp_to_next_level: newXpToNext,
            total_xp: (pp.total_xp ?? 0) + xpGain,
          };
          if (score === 1) patch[winField] = (pp[winField] ?? 0) + 1;
          else if (score === 0) patch[lossField] = (pp[lossField] ?? 0) + 1;
          if (!isFree) {
            const r = computeRank(pp.rank_tier, pp.rank_stars, pp.rank_points, score, delta);
            patch.rank_tier = r.rank_tier; patch.rank_stars = r.rank_stars; patch.rank_points = r.rank_points;
          }
          updates.push(admin.from("profiles").update(patch).eq("id", pp.id));
          if (patch.coins > (pp.coins ?? 0)) {
            updates.push(admin.rpc("bump_lifetime_coins", { p_id: pp.id, p_amount: patch.coins - (pp.coins ?? 0) }));
          }
          if (!isFree && score === 1) {
            updates.push(admin.rpc("bump_ranked_win", { p_id: pp.id }));
          }
        }
        await Promise.all(updates);

        // 降维打击：排位 10-0 零封
        if (!isFree && winnerId) {
          const loserScore = winnerId === match.player1_id ? p2 : p1;
          const winnerScore = winnerId === match.player1_id ? p1 : p2;
          if (loserScore === 0 && winnerScore >= 10) {
            await admin.rpc("grant_special_badge", { p_id: winnerId, p_name: "降维打击" });
          }
        }

        await Promise.all([
          admin.rpc("award_badges_for_profile", { p_id: p1p.id }),
          admin.rpc("award_badges_for_profile", { p_id: p2p.id }),
        ]);
        if (!isFree && winnerId) {
          await admin.rpc("increment_team_challenge_score_for_profile", { p_profile_id: winnerId });
        }
      }
    }

    const callerScore: 1 | 0 | 0.5 = winnerId === null ? 0.5 : winnerId === profile.id ? 1 : 0;
    const coinsEarned = coinReward(callerScore, isFree);
    const xpEarned = xpReward(callerScore, isFree);

    await admin.from("match_queue").delete().in("profile_id", [match.player1_id, match.player2_id]);

    return json({ ok: true, winnerId, player1_score: p1, player2_score: p2, coinsEarned, xpEarned });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
