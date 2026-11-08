import { describe, expect, it } from 'vitest';
import { consumeAnswerPermit, issueAnswerPermit } from '@/lib/dacAnswerEvent';

describe('local ranked callback permit', () => {
  it('rejects missing and fabricated capabilities', () => {
    expect(consumeAnswerPermit(undefined, 'm', 0, 'a')).toBe(false);
    expect(consumeAnswerPermit({ kind: 'dac-answer' }, 'm', 0, 'a')).toBe(false);
  });
  it('does not issue a permit for a synthetic dispatched click', () => {
    const button = document.createElement('button'); document.body.appendChild(button);
    let permit: ReturnType<typeof issueAnswerPermit>;
    button.addEventListener('click', event => { permit = issueAnswerPermit({ nativeEvent: event, currentTarget: button }, 'm', 0, 'a'); });
    button.click(); button.remove();
    expect(permit).toBeUndefined();
  });
});