export interface UserProfile {
  id: string;
  user_id: string;
  username: string;
  level: number;
  grade: number;
  rank_tier: string;
  coins: number;
  created_at: string;
  isAdmin?: boolean;
  isTeacher?: boolean;
}

export interface ParsedWord {
  word: string;
  meaning: string;
}

export interface WordStat {
  grade: number;
  count: number;
}
