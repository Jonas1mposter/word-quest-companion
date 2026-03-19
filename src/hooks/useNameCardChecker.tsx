import { useCallback } from "react";

interface Profile {
  id: string;
  [key: string]: any;
}

export const checkAndAwardNameCards = async (_profile: Profile | null) => {
  return [];
};

export const useNameCardChecker = (profile: Profile | null) => {
  const checkNameCards = useCallback(() => {
    return checkAndAwardNameCards(profile);
  }, [profile]);

  return checkNameCards;
};
