import { supabase } from "@/integrations/supabase/client";
import { boundedRequest } from "@/lib/boundedRequest";

export interface SearchOptions {
  requestId: string;
  mode: "1v1" | "2v2";
  matchType: "ranked" | "free";
  subject: string;
  partyId?: string | null;
}

export async function searchMatch(options: SearchOptions): Promise<string | null> {
  const { data, error } = await boundedRequest(supabase.functions.invoke("matchmaking", {
    body: { action: "search", ...options },
  }));
  if (error || data?.error) throw new Error("匹配请求未能确认，请检查网络后重试");
  if (data?.cancelled) throw new Error("匹配请求已取消，请重新匹配");
  return typeof data?.matchId === "string" ? data.matchId : null;
}

export async function cancelSearch(requestId: string, mode: "1v1" | "2v2", partyId: string | null = null): Promise<string | null> {
  const { data, error } = await boundedRequest(supabase.functions.invoke("matchmaking", {
    body: { action: "cancel", requestId, mode, partyId },
  }));
  if (error || data?.error) throw new Error("取消匹配未能确认，请检查网络");
  return typeof data?.matchId === "string" ? data.matchId : null;
}

export interface BotCosmetics {
  name_card: { id: string; name: string; background_gradient: string; icon: string | null; rarity: string; rank_position: number | null } | null;
  badges: { id: string; name: string; icon: string; rarity: string; slot: number }[];
}
export interface MatchBots { bot_slots: number[]; identities?: Record<string, string>; cosmetics?: Record<string, BotCosmetics> }
export async function matchBots(matchId: string): Promise<MatchBots | null> {
  const { data, error } = await boundedRequest(supabase.functions.invoke("matchmaking", {
    body: { action: "bots", matchId },
  }));
  if (error || data?.error) throw new Error("对局加载失败，请重试");
  return data?.bots ?? null;
}

export async function tickMatchBots(matchId: string) {
  return boundedRequest(supabase.functions.invoke("matchmaking", { body: { action: "tick", matchId } }));
}

export const botPlayer = (slot: number, bots?: MatchBots | null) => ({
  isAI: true,
  id: `bot-${slot}`, username: `${bots?.identities?.[String(slot)] ?? `人机 ${slot}`}（人机）`, level: 1, rank_tier: "bronze",
  rank_stars: 0, wins: 0, losses: 0, avatar_url: null,
  botCosmetics: bots?.cosmetics?.[String(slot)],
});