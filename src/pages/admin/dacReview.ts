export type ReviewStatus = 'pending' | 'upheld' | 'released';
export type ReviewCase = {
  id: string; profile_id: string; match_id: string; reason: string; status: ReviewStatus;
  username: string; grade: number; created_at: string; review_note: string | null;
  reviewed_at: string | null; banned_until?: string | null;
};
export type ReviewAnswer = {
  question_index: number; answer: string; is_correct: boolean; answered_at: string;
  issued_at: string | null; question_type: string | null; elapsed_ms: number | null;
};
export type ReviewDetail = {
  case: ReviewCase; reviewer: string | null;
  match: { mode: string; status: string; rank_voided: boolean; started_at: string | null; ended_at: string | null };
  answers: ReviewAnswer[];
  flags: { id: string; source: string; reason: string; severity: string; created_at: string; linked_to_match: boolean | null; metrics: Record<string, unknown> }[];
};
export const reviewLabels: Record<ReviewStatus, string> = { pending: '待复核', upheld: '维持拦截', released: '已放行' };
export const reasonLabels: Record<string, string> = {
  synthetic_input: '合成输入被拦截', synthetic_click: '合成点击被拦截', fixed_answer_timing: '答题节奏异常',
  tab_switch_limit: '切屏次数超限', background_away: '离开对局超时',
};
export function reviewStats(answers: ReviewAnswer[]) {
  const times = answers.map(a => a.elapsed_ms).filter((n): n is number => n !== null && Number.isFinite(n) && n >= 0);
  return { total: answers.length, correct: answers.filter(a => a.is_correct).length,
    meanMs: times.length ? times.reduce((s, n) => s + n, 0) / times.length : null };
}
export function canReview(status: ReviewStatus, decision: 'released' | 'upheld', note: string) {
  return note.trim().length >= 1 && note.trim().length <= 1000 &&
    (status === 'pending' || (status === 'upheld' && decision === 'released'));
}