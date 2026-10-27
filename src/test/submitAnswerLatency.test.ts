import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  serve: vi.fn(), waitUntil: vi.fn(), review: vi.fn(), auth: vi.fn(),
  feedback: vi.fn(), timing: vi.fn(),
}));
vi.stubGlobal("Deno", { serve: mocks.serve });
vi.stubGlobal("EdgeRuntime", { waitUntil: mocks.waitUntil });
vi.mock("npm:zod@3.25.76", async () => await import("zod"));
vi.mock("npm:@supabase/supabase-js@2/cors", () => ({ corsHeaders: {} }));
vi.mock("../../supabase/functions/_shared/auth.ts", () => ({
  requireProfile: mocks.auth,
  json: (body: unknown, status = 200) => new Response(JSON.stringify(body), { status }),
}));
vi.mock("../../supabase/functions/_shared/answerFeedback.ts", () => ({ submittedSpellingFeedback: mocks.feedback }));
vi.mock("../../supabase/functions/_shared/answerTiming.ts", () => ({ analyzeTiming: mocks.timing }));
vi.mock("../../supabase/functions/submit-answer/review.ts", () => ({ reviewAnswer: mocks.review }));

describe("answer feedback critical path", () => {
  it("returns accepted correctness while review is still pending and retains synchronous timing forfeits", async () => {
    mocks.review.mockImplementation(() => new Promise(() => {}));
    mocks.feedback.mockResolvedValue({});
    mocks.timing.mockReturnValue({ robotic: true });
    const query: Record<string, unknown> = {};
    for (const key of ["select", "eq"]) query[key] = () => query;
    query.single = async () => ({ data: { question_count: 10 }, error: null });
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
    mocks.auth.mockResolvedValue({ profile: { id: "player" }, admin: {
      from: () => query, rpc: async () => ({ data: { ok: true, isCorrect: true }, error: null }),
    } });
    await import("../../supabase/functions/submit-answer/index.ts");
    const handler = mocks.serve.mock.calls[0]?.[0];
    expect(handler).toBeTypeOf("function");
    const response = await handler(new Request("http://localhost/submit", { method: "POST", body: JSON.stringify({
      matchId: "00000000-0000-4000-8000-000000000001", questionIndex: 0, answer: "apple",
    }) }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ isCorrect: true, dacForfeit: { reason: "fixed_answer_timing" } });
    expect(mocks.waitUntil).toHaveBeenCalledWith(expect.any(Promise));
    expect(mocks.review).toHaveBeenCalledOnce();
  });
});