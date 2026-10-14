// Weekly leaderboard name card distribution — per grade zone.
// Every zone (grade 1-9) gets its own top-10 per board; cards, coins and XP
// are awarded per zone. Runs weekly via pg_cron. Idempotent — safe to re-run.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CardConfig {
  name: string;
  orderBy: string;
  limit: number;
}

const LEADERBOARD_CARDS: Record<string, CardConfig> = {
  leaderboard_wins: { name: "狄邦排位大师", orderBy: "wins", limit: 10 },
  leaderboard_rank: { name: "狄邦不败之巅", orderBy: "rank_points", limit: 10 },
  leaderboard_xp: { name: "狄邦至高巅峰", orderBy: "total_xp", limit: 10 },
};

// Weekly coin/XP rewards by rank position (top 10 per board, per zone)
const weeklyReward = (pos: number): { coins: number; xp: number } =>
  pos === 1 ? { coins: 500, xp: 200 }
  : pos === 2 ? { coins: 300, xp: 150 }
  : pos === 3 ? { coins: 200, xp: 100 }
  : { coins: 100, xp: 50 };

const TIER_ORDER: Record<string, number> = {
  champion: 8, ace: 7, star: 6, diamond: 5, platinum: 4, gold: 3, silver: 2, bronze: 1,
};

interface ProfileLite {
  id: string;
  grade: number;
  rank_tier: string | null;
  rank_stars: number | null;
  rank_points: number | null;
  wins: number | null;
  total_xp: number | null;
}

const sortProfiles = (list: ProfileLite[], category: string): ProfileLite[] => {
  const sorted = [...list];
  if (category === "leaderboard_rank") {
    // Match LeaderboardTabs: tier > stars > points
    sorted.sort((a, b) => {
      const ta = TIER_ORDER[(a.rank_tier || "bronze").toLowerCase()] || 0;
      const tb = TIER_ORDER[(b.rank_tier || "bronze").toLowerCase()] || 0;
      if (tb !== ta) return tb - ta;
      if ((b.rank_stars || 0) !== (a.rank_stars || 0)) return (b.rank_stars || 0) - (a.rank_stars || 0);
      return (b.rank_points || 0) - (a.rank_points || 0);
    });
  } else if (category === "leaderboard_wins") {
    sorted.sort((a, b) => (b.wins || 0) - (a.wins || 0));
  } else {
    sorted.sort((a, b) => (b.total_xp || 0) - (a.total_xp || 0));
  }
  return sorted;
};

// Monday (UTC) of the current week, as YYYY-MM-DD — idempotency key
const currentWeekStart = (): string => {
  const now = new Date();
  const day = (now.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary: Record<string, unknown> = {};
  const globalTop3PerBoard: string[][] = []; // for GOAT
  const allTopIds = new Set<string>(); // for leaderboard_appearances bump + award sweep

  try {
    // --- Load all profiles once, group by grade zone ---
    const { data: allProfiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, grade, rank_tier, rank_stars, rank_points, wins, total_xp");
    if (profilesErr) throw profilesErr;
    const profiles = (allProfiles ?? []) as ProfileLite[];
    const byZone = new Map<number, ProfileLite[]>();
    for (const p of profiles) {
      const g = p.grade ?? 7;
      if (!byZone.has(g)) byZone.set(g, []);
      byZone.get(g)!.push(p);
    }
    const zones = [...byZone.keys()].sort((a, b) => a - b);

    // --- Personal leaderboards, per zone ---
    for (const [category, cfg] of Object.entries(LEADERBOARD_CARDS)) {
      const { data: card } = await supabase
        .from("name_cards").select("id").eq("name", cfg.name).maybeSingle();
      if (!card) { summary[category] = "card_missing"; continue; }

      // Global top-3 (for GOAT), computed across all profiles
      globalTop3PerBoard.push(sortProfiles(profiles, category).slice(0, 3).map((p) => p.id));

      // Zone top-10 lists
      const zoneTops: { zone: number; ids: string[] }[] = [];
      const positionById = new Map<string, number>(); // first (best) position wins
      for (const zone of zones) {
        const top = sortProfiles(byZone.get(zone)!, category).slice(0, cfg.limit);
        const ids = top.map((p) => p.id);
        zoneTops.push({ zone, ids });
        ids.forEach((id, i) => {
          if (!positionById.has(id)) positionById.set(id, i + 1);
        });
        ids.forEach((id) => allTopIds.add(id));
      }
      const topIds = [...positionById.keys()];

      // Remove from users no longer in any zone top-10
      if (topIds.length > 0) {
        await supabase.from("user_name_cards")
          .delete()
          .eq("name_card_id", card.id)
          .not("profile_id", "in", `(${topIds.join(",")})`);
      }

      // Upsert current holders with their zone rank_position
      let inserted = 0;
      for (const [pid, pos] of positionById.entries()) {
        const { data: exist } = await supabase
          .from("user_name_cards")
          .select("id")
          .eq("name_card_id", card.id)
          .eq("profile_id", pid)
          .maybeSingle();
        if (exist) {
          await supabase.from("user_name_cards")
            .update({ rank_position: pos })
            .eq("id", exist.id);
        } else {
          await supabase.from("user_name_cards").insert({
            profile_id: pid,
            name_card_id: card.id,
            rank_position: pos,
          });
          inserted++;
        }
      }

      // Weekly coin/XP rewards per zone (idempotent via weekly_leaderboard_rewards)
      const weekStart = currentWeekStart();
      let rewarded = 0;
      for (const pid of topIds) {
        const pos = positionById.get(pid)!;
        const rw = weeklyReward(pos);
        const { data: existing } = await supabase
          .from("weekly_leaderboard_rewards")
          .select("id")
          .eq("profile_id", pid)
          .eq("category", category)
          .eq("week_start", weekStart)
          .maybeSingle();
        if (existing) continue;
        const { error: rwErr } = await supabase.from("weekly_leaderboard_rewards").insert({
          profile_id: pid,
          category,
          week_start: weekStart,
          rank_position: pos,
          coins: rw.coins,
          xp: rw.xp,
        });
        if (rwErr) continue; // unique conflict = already paid
        const { data: p } = await supabase
          .from("profiles")
          .select("coins, xp, total_xp, lifetime_coins_earned")
          .eq("id", pid)
          .maybeSingle();
        if (p) {
          await supabase.from("profiles").update({
            coins: (p.coins ?? 0) + rw.coins,
            xp: (p.xp ?? 0) + rw.xp,
            total_xp: (p.total_xp ?? 0) + rw.xp,
            lifetime_coins_earned: (p.lifetime_coins_earned ?? 0) + rw.coins,
          }).eq("id", pid);
          rewarded++;
        }
      }
      summary[category] = { zones: zones.length, holders: topIds.length, new: inserted, rewarded };
    }

    // --- Champion team ---
    const { data: champCard } = await supabase
      .from("name_cards").select("id").eq("name", "冠军战队").maybeSingle();
    if (champCard) {
      const { data: topTeam } = await supabase
        .from("teams")
        .select("id, total_wins, total_xp")
        .order("total_wins", { ascending: false })
        .order("total_xp", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (topTeam) {
        const { data: members } = await supabase
          .from("team_members").select("profile_id").eq("team_id", topTeam.id);
        const memberIds = (members ?? []).map((m: any) => m.profile_id);
        if (memberIds.length > 0) {
          await supabase.from("user_name_cards")
            .delete()
            .eq("name_card_id", champCard.id)
            .not("profile_id", "in", `(${memberIds.join(",")})`);
          let inserted = 0;
          for (const pid of memberIds) {
            const { data: exist } = await supabase
              .from("user_name_cards")
              .select("id").eq("name_card_id", champCard.id)
              .eq("profile_id", pid).maybeSingle();
            if (!exist) {
              await supabase.from("user_name_cards").insert({
                profile_id: pid, name_card_id: champCard.id, rank_position: 1,
              });
              inserted++;
            }
          }
          summary.champion_team = { team_id: topTeam.id, members: memberIds.length, new: inserted };
        } else {
          summary.champion_team = "no_members";
        }
      } else {
        summary.champion_team = "no_team";
      }
    }

    // --- Bump leaderboard_appearances for users on any top10 ---
    for (const id of allTopIds) {
      const { data: p } = await supabase.from("profiles").select("leaderboard_appearances").eq("id", id).maybeSingle();
      await supabase.from("profiles").update({
        leaderboard_appearances: (p?.leaderboard_appearances ?? 0) + 1,
      }).eq("id", id);
    }

    // --- GOAT: top-3 on all three leaderboards globally ---
    let goatCount = 0;
    if (globalTop3PerBoard.length === 3 && globalTop3PerBoard.every((b) => b.length > 0)) {
      const [a, b, c] = globalTop3PerBoard;
      const goatIds = a.filter((id) => b.includes(id) && c.includes(id));
      for (const id of goatIds) {
        await supabase.rpc("grant_special_badge", { p_id: id, p_name: "GOAT" });
        goatCount++;
      }
    }
    summary.goat = goatCount;

    // --- 无限进步: every team member has >=10 ranked wins in past 7 days ---
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: teams } = await supabase.from("teams").select("id");
    let infinityCount = 0;
    for (const t of teams ?? []) {
      const { data: members } = await supabase
        .from("team_members").select("profile_id").eq("team_id", (t as any).id);
      const memberIds = (members ?? []).map((m: any) => m.profile_id);
      if (memberIds.length < 2) continue;
      let allQualify = true;
      for (const pid of memberIds) {
        const { count } = await supabase
          .from("ranked_matches")
          .select("id", { count: "exact", head: true })
          .eq("winner_id", pid)
          .eq("status", "completed")
          .gte("created_at", since);
        if ((count ?? 0) < 10) { allQualify = false; break; }
      }
      if (allQualify) {
        for (const pid of memberIds) {
          await supabase.rpc("grant_special_badge", { p_id: pid, p_name: "无限进步" });
          infinityCount++;
        }
      }
    }
    summary.infinity = infinityCount;

    // --- Sweep award_badges_for_profile for affected users (covers 声名远扬 tiers etc.) ---
    for (const id of allTopIds) {
      await supabase.rpc("award_badges_for_profile", { p_id: id });
    }

    return new Response(JSON.stringify({ ok: true, summary, ts: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
