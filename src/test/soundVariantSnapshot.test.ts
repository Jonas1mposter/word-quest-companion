import { describe, it, expect } from 'vitest';
import { getSoundVariantState } from '@/hooks/useMatchSounds';

describe('局内音效控制台状态', () => {
  it('状态未变时返回同一引用，避免无限重渲染黑屏', () => {
    expect(getSoundVariantState()).toBe(getSoundVariantState());
  });
});
