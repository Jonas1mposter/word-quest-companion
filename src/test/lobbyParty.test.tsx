import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomeLobby from "@/components/dashboard/HomeLobby";
import { MemoryRouter } from "react-router-dom";
import type { useLobbyParty } from "@/hooks/useLobbyParty";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => { const q = { select: () => q, eq: () => q, maybeSingle: () => Promise.resolve({ data: null }) }; return q; },
} }));
vi.mock("@/components/PlayerStats", () => ({ default: () => null }));
vi.mock("@/components/RankDisplay", () => ({ default: () => null }));
vi.mock("@/components/DailyQuest", () => ({ default: () => null }));
vi.mock("@/components/dashboard/CheckInCard", () => ({ default: () => null }));
vi.mock("@/components/dashboard/LobbyCardCropper", () => ({ default: () => null }));

const host = { id: "host", username: "Host", grade: 7, rank_tier: "bronze", rank_stars: 0, wins: 0, losses: 0 };
const friend = { id: "friend", username: "Friend", grade: 7, level: 3, rank_tier: "silver", avatar_url: null, lobby_card_image: null };
const party = { id: "party", leader_id: "host", member_id: "friend", invited_id: "friend", status: "ready", match_id: null, subject: "mixed", expires_at: "2099-01-01" };
function state(overrides: Partial<ReturnType<typeof useLobbyParty>> = {}): ReturnType<typeof useLobbyParty> {
  return { party: null, teammate: null, friends: [friend], loadingFriends: false, busy: false, isHost: true, canStart: true,
    loadFriends: vi.fn(), invite: vi.fn().mockResolvedValue(true), leave: vi.fn().mockResolvedValue(true), prepare: vi.fn().mockResolvedValue(true), ...overrides };
}
function show(partyState: ReturnType<typeof useLobbyParty>, profile = host, onNavigate = vi.fn()) {
  return render(<MemoryRouter><HomeLobby profile={profile} partyState={partyState} grade={7} playerData={{ username: profile.username, level: 3 }}
    refreshKey={0} onEnergyPurchased={vi.fn()} onNavigate={onNavigate} onStartMatch={vi.fn()} onFreeMatch={vi.fn()} /></MemoryRouter>);
}
afterEach(cleanup);
describe("主大厅好友组队", () => {
  it("加号选择好友发出邀请，加入后双方显示各自卡面", async () => {
    const solo = state();
    const { unmount } = show(solo);
    fireEvent.click(screen.getByRole("button", { name: "邀请好友组队" }));
    expect(solo.loadFriends).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "邀请 Friend" }));
    await waitFor(() => expect(solo.invite).toHaveBeenCalledWith(friend));
    unmount();
    show(state({ party, teammate: friend }));
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.getByText("Friend")).toBeInTheDocument();
  });
  it("房主已就绪仅能开始2v2，所有单人入口禁用", () => {
    const navigate = vi.fn();
    show(state({ party, teammate: friend }), host, navigate);
    fireEvent.click(screen.getByRole("button", { name: "开始游戏" }));
    for (const mode of ["排位赛", "闯关模式", "自由服", "人机对战", "好友对战", "娱乐模式"]) {
      expect(screen.getByRole("button", { name: new RegExp(mode) })).toBeDisabled();
    }
    fireEvent.click(screen.getByRole("button", { name: /2v2 组队/ }));
    expect(navigate).toHaveBeenCalledWith("battle2v2-select");
  });
  it("队员看得到房主卡面但不能开始", () => {
    show(state({ party, teammate: { ...friend, id: "host", username: "Host" }, isHost: false, canStart: false }), { ...host, id: "friend", username: "Friend" });
    expect(screen.getByText("Host")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "等待房主开始" })).toBeDisabled();
  });
  it("房主等待邀请接受时不可开始", () => {
    show(state({ party: { ...party, member_id: null, status: "pending" }, teammate: friend, canStart: false }));
    expect(screen.getByRole("button", { name: "等待好友加入" })).toBeDisabled();
  });
});