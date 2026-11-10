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
    const [general, admins] = await Promise.all([
      supabase.rpc("leaderboard_excluded_ids" as any),
      supabase.rpc("leaderboard_admin_profile_ids" as any),
    ]);
    if (general.error) return [];
    const ids = [...(general.data as any[]) || [], ...((admins.data as any[]) || [])]
      .map((r: any) => (typeof r === "string" ? r : r?.leaderboard_excluded_ids ?? r?.leaderboard_admin_profile_ids ?? r?.id))
      .filter(Boolean);
    const unique = [...new Set(ids)];
    if (unique.length) cache = unique;
    return unique;
  } catch {
    return [];
  }
}

/** PostgREST `not in` filter value, or null when nothing to exclude. */
export const excludedInFilter = (ids: string[]) => (ids.length ? `(${ids.join(",")})` : null);
