import { describe, expect, it, vi } from 'vitest';
import ts from 'typescript';
import { z } from 'zod';
import source from '../../supabase/functions/submit-answer/index.ts?raw';

describe('server DAC enforcement on answer retries', () => {
  it('rechecks persisted timing on duplicates without scheduling duplicate review', async () => {
    let handler: ((req: Request) => Promise<Response>) | undefined;
    const review = vi.fn(), voidRank = vi.fn().mockResolvedValue(true), timing = vi.fn(() => ({ robotic: true, samples: 6 }));
    const query: any = {};
    for (const key of ['select', 'eq']) query[key] = () => query;
    query.single = async () => ({ data: { question_count: 15 }, error: null });
    query.then = (resolve: any) => Promise.resolve({ data: [{ question_index: 6 }], error: null }).then(resolve);
    const admin = { from: () => query, rpc: vi.fn().mockResolvedValue({ data: { ok: true, isCorrect: true, duplicate: true }, error: null }) };
    const compiled = ts.transpile(source.replace(/^import .*;\n/gm, ''), { target: ts.ScriptTarget.ES2022 });
    new Function('Deno', 'EdgeRuntime', 'z', 'corsHeaders', 'requireProfile', 'json', 'submittedSpellingFeedback', 'analyzeTiming', 'reviewAnswer', 'voidDacRank', compiled)(
      { serve: (h: typeof handler) => { handler = h; } }, { waitUntil: vi.fn() }, z, {}, async () => ({ admin, profile: { id: 'p' } }),
      (b: unknown, status = 200) => new Response(JSON.stringify(b), { status }), async () => ({}), timing, review, voidRank,
    );
    if (!handler) throw new Error('Missing handler');
    const response = await handler(new Request('http://localhost/submit', { method: 'POST', body: JSON.stringify({ matchId: '00000000-0000-4000-8000-000000000001', questionIndex: 6, answer: 'apple' }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ dacForfeit: { reason: 'fixed_answer_timing' } });
    expect(voidRank).toHaveBeenCalledWith(admin, '00000000-0000-4000-8000-000000000001', 'p', 'fixed_answer_timing');
    expect(timing).toHaveBeenCalledWith([{ question_index: 6 }]);
    expect(review).not.toHaveBeenCalled();
  });
});