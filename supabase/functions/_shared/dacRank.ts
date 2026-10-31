// Only actual kick reasons invalidate a match; review-only signals do not.
export function isDacKick(reason: unknown): boolean {
  return typeof reason === "string" && [
    "synthetic_input", "synthetic_click", "fixed_answer_timing",
    "tab_switch_limit", "background_away",
  ].includes(reason);
}

export async function voidDacRank(admin: {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}, matchId: string, profileId: string, reason: unknown): Promise<boolean> {
  if (!isDacKick(reason)) return false;
  const { data, error } = await admin.rpc("void_dac_match_rank", {
    p_match_id: matchId, p_profile_id: profileId, p_reason: reason,
  });
  if (error) throw new Error(error.message);
  return data === true;
}