import { supabase } from "@/integrations/supabase/client";
import { boundedRequest } from "@/lib/boundedRequest";

export type BossRole = "damage" | "guardian" | "healer";
export const BOSS_ROLES = {
  damage: { name: "输出", detail: "攻击 18 · 治疗 18" },
  guardian: { name: "守护", detail: "攻击 10 · 治疗 18" },
  healer: { name: "治疗", detail: "攻击 10 · 治疗 32" },
};
export interface BossPlayer {
  id: string; name: string; avatar: string | null; role: BossRole; ready: boolean;
  hp: number; answered: number; correct: number; coins: number;
  submitted: boolean; acted: boolean; action: string | null; target: string | null;
}
export interface BossState {
  id: string; host: string; phase: "lobby" | "combat" | "won" | "lost" | "cancelled";
  round: number; bossHp: number; bossMax: number; partySize: number;
  deadline: string; endsAt: string | null; serverNow: string; charging: boolean; required: number;
  players: BossPlayer[]; dailyCoins: number; dailyCap: number;
  question: { round: number; kind: "choice" | "spelling"; prompt: string; options: string[];
    submitted: boolean; correct: boolean | null; acted: boolean; feedback: { word: string; meaning: string } | null } | null;
  log: { round?: number; damage?: number; correct?: number; interrupted?: boolean; incoming?: number };
}
export interface BossRequest { action: string; run?: string; round?: number; choice?: string; target?: string }
export interface BossResult { state: BossState | null; team: { id: string; name: string } | null }
export const canStartBoss = (state: BossState, profileId: string) => state.phase === "lobby" &&
  state.host === profileId && state.players.length >= 3 && state.players.length <= 5 && state.players.every(p => p.ready);
export async function bossAction(request: BossRequest): Promise<BossResult> {
  const { data, error } = await boundedRequest(supabase.functions.invoke("team-boss", { body: request }), 12000);
  if (error || data?.error) throw new Error(data?.error || "请求未能确认，请重试");
  return data as BossResult;
}