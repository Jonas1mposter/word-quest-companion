import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PlayerBattleCard from "@/components/battle/PlayerBattleCard";
import { hasIcon } from "@/components/ui/badge-icon";

const { rows } = vi.hoisted(() => ({ rows: { current: [] as unknown[] } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      const query = {
        select: () => query,
        eq: () => query,
        not: () => query,
        order: () => query,
        limit: () => Promise.resolve({ data: rows.current }),
        single: () => Promise.resolve({ data: null }),
      };
      return query;
    },
  },
}));

const profile = { id: "player", username: "Player", level: 1, rank_tier: "bronze", rank_stars: 0, wins: 0, losses: 0 };
afterEach(cleanup);

describe("battle equipped badges", () => {
  it("shows all three zero-based equipped slots, including slot zero", async () => {
    rows.current = [0, 1, 2].map(slot => ({
      equipped_slot: slot,
      badges: { id: `badge-${slot}`, name: `Badge ${slot}`, icon: "Trophy", rarity: "rare" },
    }));
    render(<PlayerBattleCard profile={profile} variant="left" />);
    for (const slot of [0, 1, 2]) {
      expect(await screen.findByTitle(`Badge ${slot}`)).toBeInTheDocument();
    }
    expect(screen.queryByTitle("空勋章槽")).not.toBeInTheDocument();
  });

  it("skips a missing joined badge without hiding the remaining badges", async () => {
    rows.current = [
      { equipped_slot: 0, badges: null },
      { equipped_slot: 2, badges: { id: "valid", name: "Valid badge", icon: "Shield", rarity: "rare" } },
    ];
    render(<PlayerBattleCard profile={profile} variant="right" />);
    expect(await screen.findByTitle("Valid badge")).toBeInTheDocument();
  });

  it("does not carry a previous player's badges into an AI card", async () => {
    rows.current = [{ equipped_slot: 0, badges: { id: "old", name: "Previous badge", icon: "Trophy", rarity: "rare" } }];
    const { rerender } = render(<PlayerBattleCard profile={profile} variant="left" />);
    await screen.findByTitle("Previous badge");
    rerender(<PlayerBattleCard profile={{ ...profile, id: "bot", isAI: true }} variant="left" />);
    await waitFor(() => expect(screen.queryByTitle("Previous badge")).not.toBeInTheDocument());
  });

  it("supports the developer-team Code icon stored in the badge catalogue", () => {
    expect(hasIcon("Code")).toBe(true);
  });
});