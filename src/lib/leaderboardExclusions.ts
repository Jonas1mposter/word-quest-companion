import { supabase } from "@/integrations/supabase/client";

let cache: Promise<string[]> | null = null;

/** Profile ids (admins) that never appear on any leaderboard. */
export function getLeaderboardExcludedIds(): Promise<string[]> {
  if (!cache) {
    cache = (async () => {
      const { data } = await supabase.rpc("leaderboard_excluded_ids" as any);
      return ((data as any[]) || []).map((r: any) => (typeof r === "string" ? r : r?.leaderboard_excluded_ids ?? r?.id)).filter(Boolean);
    })().catch(() => []);
  }
  return cache;
}

/** PostgREST `not in` filter value, or null when nothing to exclude. */
export const excludedInFilter = (ids: string[]) => (ids.length ? `(${ids.join(",")})` : null);
