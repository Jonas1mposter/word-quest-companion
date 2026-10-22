import { supabase } from "@/integrations/supabase/client";
import { boundedRequest } from "@/lib/boundedRequest";

export type RogueNode = "battle" | "elite" | "rest" | "event" | "boss";
export type RogueSkill = "combo" | "ward" | "healing" | "power" | "armor" | "echo";
export interface RogueState {
  id: string; phase: "route" | "combat" | "skill" | "won" | "lost" | "abandoned";
  floor: number; hp: number; maxHp: number; enemyHp: number; enemyMax: number;
  node: RogueNode; routes: RogueNode[]; skills: Partial<Record<RogueSkill, number>>; offers: RogueSkill[];
  streak: number; answered: number; correct: number; version: number; coins: number;
  dailyCoins: number; dailyCap: number; endsAt: string; serverNow: string; event: string | null;
  question: { index: number; kind: "choice" | "listening"; prompt: string; options: string[] } | null;
}
export interface RogueFeedback { correct: boolean; answer: string; word: string; damage: number; healing: number }
export interface RogueAction { action: string; run?: string; version?: number; choice?: string; index?: number }
export async function rogueAction(request: RogueAction): Promise<{ state: RogueState | null; feedback?: RogueFeedback }> {
  const { data, error } = await boundedRequest(supabase.rpc("rogue_action", {
    p_action: request.action, p_run: request.run, p_version: request.version, p_choice: request.choice, p_index: request.index,
  }), 15000);
  if (error) throw new Error(error.message);
  if (!data) return { state: null };
  const result = data as unknown as RogueState | { state: RogueState; feedback: RogueFeedback };
  return "state" in result ? result : { state: result };
}
export const ROGUE_NODES = {
  battle: { name: "普通战斗", detail: "敌人生命 24 · 答错受伤 10", enemy: "荆棘书灵" },
  elite: { name: "精英战斗", detail: "敌人生命 40 · 答错受伤 14 · 技能 +2", enemy: "遗迹猎手" },
  rest: { name: "休息点", detail: "恢复 22 生命", enemy: "篝火" },
  event: { name: "随机事件", detail: "泉水或古代遗物", enemy: "林间奇遇" },
  boss: { name: "关底 Boss", detail: "生命 80 · 半血进入狂暴", enemy: "古树守护者" },
};
export const ROGUE_SKILLS = {
  combo: { name: "连击烈焰", family: "连击流", detail: "每级：连续答对每层 +1 伤害，最多叠 5 层" },
  ward: { name: "初错护盾", family: "防守流", detail: "每场首次答错免伤（升级不增加次数）" },
  healing: { name: "听音回春", family: "听力流", detail: "每级：听力答对恢复 4 生命" },
  power: { name: "锋利词刃", family: "连击流", detail: "每级：答对攻击 +2" },
  armor: { name: "墨甲", family: "防守流", detail: "每级：受到伤害减少 2，最低 2" },
  echo: { name: "回声冲击", family: "听力流", detail: "每级：听力答对额外 +3 伤害" },
};