import { describe, it, expect } from "vitest";
import { canStartBoss, type BossState, type BossPlayer } from "@/lib/teamBoss";
const player = (id: string): BossPlayer => ({ id, name: id, avatar: null, role: "damage", ready: true, hp: 100, answered: 0, correct: 0, coins: 0, submitted: false, acted: false, action: null, target: null });
const lobby = (count: number): BossState => ({ id: "r", host: "p0", phase: "lobby", round: 0, bossHp: 0, bossMax: 0, partySize: 0, deadline: "", endsAt: null, serverNow: "", charging: false, required: 0, players: Array.from({ length: count }, (_, i) => player(`p${i}`)), question: null, log: {}, dailyCoins: 0, dailyCap: 180 });
describe("战队 Boss 开局规则", () => {
  it("3人可开局", () => expect(canStartBoss(lobby(3), "p0")).toBe(true));
  it("5人可开局", () => expect(canStartBoss(lobby(5), "p0")).toBe(true));
  it("2人不能开局", () => expect(canStartBoss(lobby(2), "p0")).toBe(false));
  it("6人不能开局", () => expect(canStartBoss(lobby(6), "p0")).toBe(false));
  it("只有房主能开始", () => expect(canStartBoss(lobby(3), "p1")).toBe(false));
  it("所有人须准备", () => { const s = lobby(3); s.players[2].ready = false; expect(canStartBoss(s, "p0")).toBe(false); });
});