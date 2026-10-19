import { describe, expect, it, vi } from "vitest";
import { submittedSpellingFeedback } from "../../supabase/functions/_shared/answerFeedback";

function client(submitted: boolean, kind = "spelling") {
  const filters: Record<string, Record<string, unknown>> = {};
  const from = vi.fn((table: string) => {
    filters[table] = {};
    const query = {
      select: () => query,
      eq: (field: string, value: unknown) => { filters[table][field] = value; return query; },
      maybeSingle: async () => ({ data: table === "match_answers" ? submitted ? { question_index: 2 } : null
        : table === "match_question_issues" ? { question_type: kind }
        : { words: [{ word: "future-hidden" }, {}, { word: "apple" }, { word: "pear" }] }, error: null }),
    };
    return query;
  });
  return { from, filters };
}

describe("post-submission answer privacy", () => {
  it.each(["spelling", "listening"])("reveals only the submitted %s answer", async kind => {
    const admin = client(true, kind);
    expect(await submittedSpellingFeedback(admin, "match", "player", 2, { ok: true })).toEqual({ correctAnswer: "apple" });
    expect(admin.filters.match_answers).toEqual({ match_id: "match", player_id: "player", question_index: 2 });
    expect(admin.filters.match_question_issues).toEqual({ match_id: "match", profile_id: "player", question_index: 2 });
  });
  it("does not read secrets for an unsubmitted question even after a match-ended response", async () => {
    const admin = client(false);
    expect(await submittedSpellingFeedback(admin, "match", "player", 2, { ok: true })).toEqual({});
    expect(admin.from).not.toHaveBeenCalledWith("match_question_secrets");
  });
  it("does not disclose an answer for rejected submissions", async () => {
    const admin = client(true);
    expect(await submittedSpellingFeedback(admin, "match", "player", 2, { ok: false })).toEqual({});
    expect(admin.from).not.toHaveBeenCalled();
  });
  it("does not disclose choice answers", async () => {
    const admin = client(true, "meaning");
    expect(await submittedSpellingFeedback(admin, "match", "player", 2, { ok: true })).toEqual({});
    expect(admin.from).not.toHaveBeenCalledWith("match_question_secrets");
  });
});