import { describe, it, expect } from 'vitest';
import { canReview, reviewStats } from '../pages/admin/dacReview';
describe('DAC manual review rules', () => {
  it('requires an administrator reason before release', () => {
    expect(canReview('pending', 'released', '   ')).toBe(false);
    expect(canReview('pending', 'released', '复核通过')).toBe(true);
  });
  it('allows later release of an upheld case but does not reopen a released case', () => {
    expect(canReview('upheld', 'released', '补充核查通过')).toBe(true);
    expect(canReview('released', 'upheld', '重新拦截')).toBe(false);
  });
  it('derives timing only from recorded server issue durations', () => {
    const base = { question_index: 0, answer: 'apple', is_correct: true, answered_at: '', issued_at: null, question_type: 'spelling' };
    expect(reviewStats([{ ...base, elapsed_ms: 1000 }, { ...base, elapsed_ms: 3000 }, { ...base, is_correct: false, elapsed_ms: null }])).toEqual({ total: 3, correct: 2, meanMs: 2000 });
  });
});