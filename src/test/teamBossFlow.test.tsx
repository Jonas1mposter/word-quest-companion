import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const action = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ profile: { id: "p" }, loading: false, refreshProfile: vi.fn() }) }));
vi.mock("@/hooks/useLobbyParty", () => ({ useLobbyParty: () => ({ party: null }) }));
vi.mock("@/lib/teamBoss", async original => ({ ...await original<object>(), bossAction: action }));
import TeamBoss from "@/pages/TeamBoss";
const state = { id: "r", host: "p", phase: "combat", round: 1, bossHp: 360, bossMax: 360, partySize: 3, deadline: new Date(Date.now() + 75000).toISOString(), endsAt: new Date(Date.now() + 600000).toISOString(), serverNow: new Date().toISOString(), charging: false, required: 3, dailyCoins: 0, dailyCap: 180, log: {}, players: [{ id: "p", name: "Player", role: "healer", ready: true, hp: 100, coins: 0 }, { id: "ally", name: "Ally", role: "damage", ready: true, hp: 0, coins: 0 }], question: { round: 1, kind: "choice", prompt: "apple", options: ["苹果", "梨", "香蕉", "葡萄"], submitted: false, correct: null, acted: false, feedback: null } };
beforeEach(() => action.mockReset()); afterEach(cleanup);
it("先答题后治疗倒地队友", async () => {
 action.mockResolvedValueOnce({ state, team: { id: "t", name: "Team" } }).mockResolvedValueOnce({ state: { ...state, question: { ...state.question, submitted: true, correct: true, feedback: { word: "apple", meaning: "苹果" } } } }).mockResolvedValueOnce({ state: { ...state, question: { ...state.question, submitted: true, correct: true, acted: true } } });
 render(<MemoryRouter><TeamBoss /></MemoryRouter>);
 fireEvent.click(await screen.findByRole("button", { name: "A 苹果" }));
 const heal = await screen.findByRole("button", { name: "治疗" });
 expect(heal).toBeDisabled();
 fireEvent.click(screen.getByRole("button", { name: "Ally · 0" }));
 fireEvent.click(heal);
 await waitFor(() => expect(action).toHaveBeenLastCalledWith({ action: "act", run: "r", round: 1, choice: "heal", target: "ally" }));
});
it("失败提交只重试原答案", async () => {
 action.mockResolvedValueOnce({ state }).mockRejectedValueOnce(new Error("网络故障")).mockResolvedValueOnce({ state });
 render(<MemoryRouter><TeamBoss /></MemoryRouter>);
 fireEvent.click(await screen.findByRole("button", { name: "A 苹果" }));
 fireEvent.click(await screen.findByRole("button", { name: "重试原答案" }));
 await waitFor(() => expect(action).toHaveBeenCalledTimes(3));
 expect(action.mock.calls[2][0]).toEqual(action.mock.calls[1][0]);
});