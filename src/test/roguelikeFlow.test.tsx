import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const action = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ profile: { id: "p", grade: 7 }, loading: false, refreshProfile: vi.fn() }) }));
vi.mock("@/hooks/useLobbyParty", () => ({ useLobbyParty: () => ({ party: null }) }));
vi.mock("@/lib/roguelike", async importOriginal => ({ ...await importOriginal<object>(), rogueAction: action }));
import Roguelike from "@/pages/Roguelike";
const route = { id: "run", phase: "route", floor: 1, hp: 80, maxHp: 80, enemyHp: 0, enemyMax: 0, routes: ["battle","elite","rest"], skills: {}, offers: [], version: 0, answered: 0, correct: 0, streak: 0, coins: 0, dailyCoins: 0, dailyCap: 120, endsAt: new Date(Date.now()+480000).toISOString(), serverNow: new Date().toISOString() };
const combat = { ...route, phase: "combat", node: "battle", enemyHp: 24, enemyMax: 24, version: 1, question: { index: 0, kind: "choice", prompt: "apple", options: ["苹果","梨","香蕉","葡萄"] } };
beforeEach(() => action.mockReset()); afterEach(cleanup);
describe("肉鸽交互", () => {
  it("选路线后失败提交只能重试同一个答案，反馈后才继续", async () => {
    action.mockResolvedValueOnce({ state: route }).mockResolvedValueOnce({ state: combat }).mockRejectedValueOnce(new Error("网络故障")).mockResolvedValueOnce({ state: { ...combat, version: 2, answered: 1, enemyHp: 16 }, feedback: { correct: true, answer: "苹果", word: "apple", damage: 8, healing: 0 } });
    render(<MemoryRouter><Roguelike /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /普通战斗/ }));
    fireEvent.click(await screen.findByRole("button", { name: "A 苹果" }));
    const retry = await screen.findByRole("button", { name: "重试原答案" });
    expect(screen.getByRole("button", { name: "B 梨" })).toBeDisabled();
    fireEvent.click(retry);
    await screen.findByRole("button", { name: "继续" });
    expect(action.mock.calls[2][0]).toEqual({ action: "answer", run: "run", version: 1, choice: "苹果", index: 0 });
    expect(action.mock.calls[3][0]).toEqual(action.mock.calls[2][0]);
    fireEvent.click(screen.getByRole("button", { name: "继续" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "A 苹果" })).toBeEnabled());
  });
  it("只有服务器提供的三种技能可以选择", async () => {
    action.mockResolvedValueOnce({ state: { ...route, phase: "skill", version: 5, offers: ["combo","ward","healing"], node: "battle" } }).mockResolvedValueOnce({ state: { ...route, floor: 2, version: 6, skills: { combo: 1 } } });
    render(<MemoryRouter><Roguelike /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /连击烈焰/ }));
    await waitFor(() => expect(action).toHaveBeenLastCalledWith({ action: "skill", run: "run", version: 5, choice: "combo", index: undefined }));
  });
});