import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BadgeData, NameCardData, BestRecords, RankTier } from "./constants";

export function useProfileCardData(profile: any) {
  const [userBadges, setUserBadges] = useState<BadgeData[]>([]);
  const [equippedBadges, setEquippedBadges] = useState<(BadgeData | null)[]>([null, null, null]);
  const [allNameCards, setAllNameCards] = useState<NameCardData[]>([]);
  const [userNameCards, setUserNameCards] = useState<NameCardData[]>([]);
  const [equippedNameCard, setEquippedNameCard] = useState<NameCardData | null>(null);
  const [bestRecords, setBestRecords] = useState<BestRecords>({
    bestWinStreak: 0,
    bestRankTier: "bronze",
    bestRankStars: 0,
  });

  const fetchUserBadges = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("user_badges")
      .select(`badge_id, equipped_slot, badges (id, name, description, icon, category, rarity)`)
      .eq("profile_id", profile.id);

    if (data) {
      const badges: BadgeData[] = data.map((ub: any) => ({
        ...ub.badges,
        equipped_slot: ub.equipped_slot,
      }));
      setUserBadges(badges);
      const equipped: (BadgeData | null)[] = [null, null, null];
      badges.forEach((b) => {
        if (b.equipped_slot !== null && b.equipped_slot !== undefined && b.equipped_slot >= 0 && b.equipped_slot < 3) {
          equipped[b.equipped_slot] = b;
        }
      });
      setEquippedBadges(equipped);
    }
  }, [profile?.id]);

  const fetchUserNameCards = useCallback(async () => {
    if (!profile?.id) return;
    const { data: allCards } = await supabase
      .from("name_cards")
      .select("*")
      .order("created_at");
    const { data: ownedCards } = await supabase
      .from("user_name_cards")
      .select(`name_card_id, is_equipped, rank_position, name_cards (id, name, description, background_gradient, icon, category, rarity)`)
      .eq("profile_id", profile.id);

    const ownedCardIds = new Set(ownedCards?.map((c: any) => c.name_card_id) || []);
    const ownedCardsMap = new Map(ownedCards?.map((c: any) => [c.name_card_id, c]) || []);

    if (allCards) {
      const cards: NameCardData[] = allCards.map((card: any) => {
        const owned = ownedCardsMap.get(card.id) as any;
        return {
          ...card,
          is_equipped: owned?.is_equipped || false,
          is_owned: ownedCardIds.has(card.id),
          rank_position: owned?.rank_position || null,
        };
      });
      setAllNameCards(cards);
      const userOwned = cards.filter((c) => c.is_owned);
      setUserNameCards(userOwned);
      setEquippedNameCard(userOwned.find((c) => c.is_equipped) || null);
    }
  }, [profile?.id]);

  const fetchBestRecords = useCallback(async () => {
    if (!profile?.id) return;
    try {
      const { data: matches, error } = await supabase
        .from("ranked_matches")
        .select("winner_id, created_at")
        .or(`player1_id.eq.${profile.id},player2_id.eq.${profile.id}`)
        .eq("status", "completed")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching matches for best records:", error);
        return;
      }

      let bestWinStreak = 0;
      let currentStreak = 0;
      if (matches) {
        const sorted = [...matches].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        for (const match of sorted) {
          if (match.winner_id === profile.id) {
            currentStreak++;
            bestWinStreak = Math.max(bestWinStreak, currentStreak);
          } else {
            currentStreak = 0;
          }
        }
      }

      setBestRecords({
        bestWinStreak,
        bestRankTier: (profile.rank_tier || "bronze") as RankTier,
        bestRankStars: profile.rank_stars || 0,
      });
    } catch (err) {
      console.error("Error in fetchBestRecords:", err);
    }
  }, [profile?.id, profile?.rank_tier, profile?.rank_stars]);

  useEffect(() => {
    if (profile?.id) {
      (async () => {
        try { await supabase.rpc("award_badges_for_profile" as any, { p_id: profile.id }); } catch {}
        await fetchUserBadges();
        await fetchUserNameCards();
        await fetchBestRecords();
      })();
    }
  }, [profile?.id, fetchUserBadges, fetchUserNameCards, fetchBestRecords]);

  return {
    userBadges, equippedBadges,
    allNameCards, userNameCards, equippedNameCard,
    bestRecords,
    refetchBadges: fetchUserBadges,
    refetchNameCards: fetchUserNameCards,
  };
}
