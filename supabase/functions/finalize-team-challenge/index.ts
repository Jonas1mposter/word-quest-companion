import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile, supabase } = await requireProfile(req);

    // Admin only
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: profile.user_id,
      _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { seasonId } = await req.json();
    if (typeof seasonId !== "string") return json({ error: "Bad request" }, 400);

    const { data: season } = await admin
      .from("team_challenge_seasons")
      .select("*")
      .eq("id", seasonId)
      .single();
    if (!season) return json({ error: "Season not found" }, 404);
    if (season.status === "ended") {
      return json({ error: "Season already finalized" }, 409);
    }

    const { data: scores } = await admin
      .from("team_challenge_scores")
      .select("team_id, points")
      .eq("season_id", seasonId)
      .order("points", { ascending: false });

    const tiers: number[] = season.reward_tiers ?? [];
    const ranked = (scores ?? []).filter((s) => s.points > 0);

    const rewards: { season_id: string; team_id: string; profile_id: string; rank: number; coins: number }[] = [];
    for (let i = 0; i < ranked.length && i < tiers.length; i++) {
      const teamId = ranked[i].team_id;
      const coins = tiers[i];
      if (!coins || coins <= 0) continue;

      const { data: members } = await admin
        .from("team_members")
        .select("profile_id")
        .eq("team_id", teamId);

      for (const m of members ?? []) {
        rewards.push({
          season_id: seasonId,
          team_id: teamId,
          profile_id: m.profile_id,
          rank: i + 1,
          coins,
        });
      }
    }

    if (rewards.length > 0) {
      // Insert reward log
      await admin.from("team_challenge_rewards").insert(rewards);

      // Bump coins on each profile (service role bypasses guard trigger)
      const profileIds = Array.from(new Set(rewards.map((r) => r.profile_id)));
      const { data: profs } = await admin
        .from("profiles")
        .select("id, coins")
        .in("id", profileIds);
      const coinMap = new Map<string, number>((profs ?? []).map((p: any) => [p.id, p.coins ?? 0]));
      const add = new Map<string, number>();
      for (const r of rewards) add.set(r.profile_id, (add.get(r.profile_id) ?? 0) + r.coins);

      await Promise.all(
        Array.from(add.entries()).map(([pid, amt]) =>
          admin.from("profiles").update({ coins: (coinMap.get(pid) ?? 0) + amt }).eq("id", pid),
        ),
      );
    }

    await admin
      .from("team_challenge_seasons")
      .update({ status: "ended", finalized_at: new Date().toISOString() })
      .eq("id", seasonId);

    return json({ ok: true, rewardedTeams: Math.min(ranked.length, tiers.length), totalRewards: rewards.length });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
