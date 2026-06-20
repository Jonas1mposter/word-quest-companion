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

      const { data: players } = await admin
        .from("profiles")
        .select(`id, ${eloField}, ${winField}, ${lossField}`)
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

        const updates: Promise<unknown>[] = [];
        for (const [pp, delta, score] of [[p1p, d1, s1], [p2p, d2, s2]] as const) {
          const patch: Record<string, any> = {
            [eloField]: Math.max(100, (pp[eloField] ?? 1000) + delta),
          };
          if (score === 1) patch[winField] = (pp[winField] ?? 0) + 1;
          else if (score === 0) patch[lossField] = (pp[lossField] ?? 0) + 1;
          updates.push(admin.from("profiles").update(patch).eq("id", pp.id));
        }
        await Promise.all(updates);

        // 自动判定徽章解锁
        await Promise.all([
          admin.rpc("award_badges_for_profile", { p_id: p1p.id }),
          admin.rpc("award_badges_for_profile", { p_id: p2p.id }),
        ]);
      }
    }

    return json({ ok: true, winnerId, player1_score: p1, player2_score: p2 });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
