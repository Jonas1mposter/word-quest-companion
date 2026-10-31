import { describe, expect, it, vi } from "vitest";
import ts from "typescript";
import source from "../../supabase/functions/process-match/index.ts?raw";
import { isDacKick, voidDacRank } from "../../supabase/functions/_shared/dacRank";
import { boostSet, applyEloBoost } from "../../supabase/functions/_shared/boosts";
import { classifyForfeit } from "../../supabase/functions/_shared/forfeitReason";

describe("DAC kick invalidates the entire ranked match", () => {
  it.each(["synthetic_input", "synthetic_click", "fixed_answer_timing", "tab_switch_limit", "background_away"])("recognizes actual kick %s", reason => {
    expect(isDacKick(reason)).toBe(true);
  });
  it.each(["surrender", "extension_injection", "native_tamper", "robotic_mouse", "unknown"])("does not void for %s", reason => {
    expect(isDacKick(reason)).toBe(false);
  });
  it.each(["1v1", "2v2"])("preserves every player's rank and shields in %s", async mode => {
    let handler: (req: Request) => Promise<Response> = async () => new Response();
    const ids = mode === "2v2" ? ["a", "b", "c", "d"] : ["a", "b"];
    const updates: Record<string, any>[] = [];
    const match = { id: "m", mode, match_type: "ranked", status: "in_progress", player1_id: "a", player2_id: "b", player3_id: ids[2], player4_id: ids[3] };
    const players = ids.map(id => ({ id, elo_rating: 1200, rank_tier: "silver", rank_stars: 10, rank_points: 0, coins: 100, xp: 0, total_xp: 0, level: 1, xp_to_next_level: 100, wins: 1, losses: 1 }));
    const rpc = vi.fn(async (name: string) => ({ data: name === "void_dac_match_rank" ? true : {}, error: null }));
    const admin = { rpc, from: (table: string) => {
      const q: any = {};
      for (const key of ["select", "eq", "neq", "in", "delete"]) q[key] = () => q;
      q.update = (patch: any) => { if (table === "profiles") updates.push(patch); if (table === "profile_boosts") throw new Error("Shield must not be consumed"); return q; };
      q.single = async () => ({ data: match });
      q.maybeSingle = async () => ({ data: null, error: null });
      q.then = (resolve: any) => Promise.resolve({ data: table === "profiles" ? players : table === "match_answers" ? ids.map(player_id => ({ player_id, is_correct: true })) : table === "profile_boosts" ? ids.map(profile_id => ({ id: profile_id, profile_id, boost_type: "rank_shield", uses_remaining: 3, expires_at: null })) : [], error: null }).then(resolve);
      return q;
    } };
    const compiled = ts.transpile(source.replace(/^import .*;\n/gm, ""), { target: ts.ScriptTarget.ES2022 });
    new Function("Deno", "analyzeTiming", "corsHeaders", "requireProfile", "json", "coinMultiplier", "earnsDimensionalStrike", "earnsTwinStars", "settleEmptyMatch", "classifyForfeit", "boostSet", "applyEloBoost", "voidDacRank", compiled)(
      { serve: (h: typeof handler) => { handler = h; } }, () => ({ robotic: false }), {}, async () => ({ admin, profile: players[0] }), (b: unknown, status = 200) => new Response(JSON.stringify(b), { status }), () => 1, () => false, () => false, async () => null, classifyForfeit, boostSet, applyEloBoost, voidDacRank,
    );
    const response = await handler(new Request("http://localhost/process", { method: "POST", body: JSON.stringify({ matchId: "m", forfeit: { reason: "synthetic_input" } }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ rankVoided: true, shielded: false });
    expect(updates).toHaveLength(ids.length);
    for (const patch of updates) {
      expect(patch.elo_rating).toBe(1200);
      expect(patch).not.toHaveProperty("rank_tier");
      expect(patch).not.toHaveProperty("rank_stars");
      expect(patch).not.toHaveProperty("rank_points");
    }
    expect(rpc).toHaveBeenCalledWith("void_dac_match_rank", { p_match_id: "m", p_profile_id: "a", p_reason: "synthetic_input" });
  });
});