import { supabase } from "@/integrations/supabase/client";

let cache: string[] | null = null;

/** Profile ids (admins) that never appear on any leaderboard. Only successful non-empty results are cached. */
export async function getLeaderboardExcludedIds(category?: "xp"): Promise<string[]> {
  if (category === "xp") {
    const [general, result] = await Promise.all([
      getLeaderboardExcludedIds(),
      supabase.rpc("leaderboard_xp_excluded_ids"),
    ]);
    if (result.error) throw result.error;
    return [...new Set([...general, ...(result.data ?? [])])];
  }
  if (cache) return cache;
  try {
    const { data, error } = await supabase.rpc("leaderboard_excluded_ids" as any);
    if (error) return [];
    const ids = ((data as any[]) || [])
      .map((r: any) => (typeof r === "string" ? r : r?.leaderboard_excluded_ids ?? r?.id))
      .filter(Boolean);
    if (ids.length) cache = ids;
    return ids;
  } catch {
    return [];
  }
}

/** PostgREST `not in` filter value, or null when nothing to exclude. */
export const excludedInFilter = (ids: string[]) => (ids.length ? `(${ids.join(",")})` : null);
