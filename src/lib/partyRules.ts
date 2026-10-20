import { contentGrade } from "./zones";

/**
 * 2v2 组队要求双方处于同一内容年级分区。
 * 高中 9-12 年级共用高中词库（contentGrade 均为 9），可以互相组队；
 * 其余年级必须完全相同。
 */
export const canTeamUp2v2 = (gradeA: number, gradeB: number): boolean =>
  contentGrade(gradeA) === contentGrade(gradeB);

export type PartyGameMode = "ranked" | "levels" | "free" | "2v2" | "bot" | "friends";
export const canSelectPartyMode = (mode: PartyGameMode, grouped: boolean): boolean =>
  !grouped || mode === "2v2";

export const canHostStartParty = (party: { leader_id: string; member_id: string | null; status: string } | null, profileId?: string): boolean =>
  !!party && party.leader_id === profileId && !!party.member_id && party.status === "ready";
