import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Swords } from "lucide-react";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), invoke: vi.fn(), removeChannel: vi.fn() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ profile: { id: "p1", username: "Player", grade: 7 } }) }));
vi.mock("@/hooks/useMatchSounds", () => ({ useMatchSounds: () => ({ playMatchFound: vi.fn(), playVictory: vi.fn(), playDefeat: vi.fn() }) }));
vi.mock("@/hooks/useMatchQueue", () => ({ useMatchQueue: () => ({ joinQueue: vi.fn(), leaveQueue: vi.fn() }) }));
vi.mock("@/lib/serverBattle", () => ({ fetchBattleQuestion: mocks.fetch, submitBattleAnswer: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  functions: { invoke: mocks.invoke }, removeChannel: mocks.removeChannel,
  channel: () => { const c = { on: () => c, subscribe: () => c }; return c; },
  from: (table: string) => {
    const data = table === "ranked_matches" ? { id: "match", player1_id: "p1", player2_id: "p2", question_count: 0, status: "in_progress", team1_score: 0, team2_score: 0 } : [];
    const q = { select: () => q, eq: () => q, in: () => q, limit: () => Promise.resolve({ data }), single: () => Promise.resolve({ data }), then: (resolve: (value: unknown) => void) => Promise.resolve({ data }).then(resolve) };
    return q;
  },
} }));
vi.mock("@/components/battle/PlayerBattleCard", () => ({ default: () => null }));
vi.mock("@/components/battle/DacBadge", () => ({ default: () => null }));
vi.mock("@/components/battle/DacCheaterNotice", () => ({ DacCheaterNotice: () => null }));
vi.mock("@/components/battle/KillStreakBanner", () => ({ default: () => null, KillStreakBanner: () => null }));
vi.mock("@/components/battle/ServerBattleQuizCard", () => ({ default: ({ question }: { question: { prompt: string } }) => <div role="article">{question.prompt}</div> }));
import BattleArena from "@/components/battle/BattleArena";
import Battle2v2Arena from "@/components/Battle2v2Arena";

describe("真人对战首题就绪门禁", () => {
  beforeEach(() => { vi.useFakeTimers(); mocks.fetch.mockReset(); mocks.invoke.mockReset(); });
  afterEach(() => { cleanup(); vi.useRealTimers(); });
  it.each(["1v1", "2v2"])("%s 未取得首题不进入对战；重试取得服务器10题后恢复", async mode => {
    mocks.fetch.mockResolvedValueOnce(null).mockResolvedValue({ questionIndex: 0, total: 10, quizType: "meaning", prompt: "apple", options: ["苹果", "梨", "香蕉", "葡萄"] });
    await act(async () => {
      render(mode === "2v2" ? <Battle2v2Arena initialMatchId="match" onBack={vi.fn()} /> : <BattleArena initialMatchId="match" onBack={vi.fn()} matchType="ranked" eloField="elo_rating" theme={{ Icon: Swords, accentText: "text-primary", accentSpinner: "border-primary", searchingTitle: "匹配", searchingSubtitle: () => "", winsField: "wins", lossesField: "losses" }} />);
    });
    for (let i = 0; i < 4; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.queryByRole("article")).toBeNull();
    expect(mocks.invoke).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "重试" })); });
    expect(screen.getByRole("article")).toHaveTextContent("apple");
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
  });
});