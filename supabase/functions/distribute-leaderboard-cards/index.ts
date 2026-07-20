// Weekly leaderboard name card distribution
// Runs every Monday via pg_cron. Idempotent — safe to re-run.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const summary: Record<string, unknown> = {};
  const top3PerBoard: string[][] = []; // for GOAT
  const allTopIds = new Set<string>(); // for leaderboard_appearances bump + award sweep

  try {
    // --- Personal leaderboards ---
    for (const [category, cfg] of Object.entries(LEADERBOARD_CARDS)) {
      const { data: card } = await supabase
        .from("name_cards").select("id").eq("name", cfg.name).maybeSingle();
      if (!card) { summary[category] = "card_missing"; continue; }

      let query = supabase.from("profiles").select("id");
      if (category === "leaderboard_rank") {
        // Match LeaderboardTabs: tier > stars > points
        query = query
          .order("rank_tier", { ascending: false, nullsFirst: false })
          .order("rank_stars", { ascending: false, nullsFirst: false })
          .order("rank_points", { ascending: false, nullsFirst: false });
      } else {
        query = query.order(cfg.orderBy, { ascending: false, nullsFirst: false });
      }
      const { data: top } = await query.limit(cfg.limit);
      const topIds = (top ?? []).map((p: any) => p.id);
      top3PerBoard.push(topIds.slice(0, 3));
      topIds.forEach((id) => allTopIds.add(id));

      // Remove from users no longer in top
      if (topIds.length > 0) {
        await supabase.from("user_name_cards")
          .delete()
          .eq("name_card_id", card.id)
          .not("profile_id", "in", `(${topIds.join(",")})`);
      }

      // Upsert current top with rank_position
      let inserted = 0;
      for (let i = 0; i < topIds.length; i++) {
        const { data: exist } = await supabase
          .from("user_name_cards")
          .select("id")
          .eq("name_card_id", card.id)
          .eq("profile_id", topIds[i])
          .maybeSingle();
        if (exist) {
          await supabase.from("user_name_cards")
            .update({ rank_position: i + 1 })
            .eq("id", exist.id);
        } else {
          await supabase.from("user_name_cards").insert({
            profile_id: topIds[i],
            name_card_id: card.id,
            rank_position: i + 1,
          });
          inserted++;
        }
      }
      summary[category] = { holders: topIds.length, new: inserted };
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

    // --- GOAT: top-3 on all three leaderboards this week ---
    let goatCount = 0;
    if (top3PerBoard.length === 3 && top3PerBoard.every((b) => b.length > 0)) {
      const [a, b, c] = top3PerBoard;
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
