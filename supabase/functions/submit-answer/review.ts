import { analyzeLookup, LOOKUP_MIN_SAMPLES } from "../_shared/answerTiming.ts";

// Review-only evidence never holds up an accepted grade; timing forfeits remain synchronous.
export async function reviewAnswer(admin: any, profile: any, match: any, matchId: string,
  questionIndex: number, elapsedMs: number | undefined, isCorrect: boolean, mine: any[], timing: { robotic: boolean }) {
    if (isCorrect) {
      let fastest: number | null =
        typeof elapsedMs === "number" && elapsedMs >= 0 ? elapsedMs : null;
      // Use persisted server timestamps, unaffected by review scheduling delay.
      const current = mine.find((row: any) => row.question_index === questionIndex);
      const prev = mine.filter((row: any) => row.question_index < questionIndex)
        .sort((a: any, b: any) => b.question_index - a.question_index)[0];
      if (current?.answered_at && prev?.answered_at) {
        const serverDelta = new Date(current.answered_at).getTime() - new Date(prev.answered_at).getTime();
        if (fastest === null || serverDelta < fastest) fastest = serverDelta;
      }
      if (fastest !== null && fastest < 1200) {
        await admin.rpc("dac_flag", {
          p_profile_id: profile.id,
          p_source: "submit-answer",
          p_reason: "impossible_answer_speed",
          p_severity: fastest < 600 ? "high" : "medium",
          p_meta: { matchId, questionIndex, elapsedMs: fastest, match_type: match.match_type, mode: match.mode },
        });
      }
    }

    const checkAt = Math.max(LOOKUP_MIN_SAMPLES, match.question_count);
    if (!timing.robotic && (mine?.length ?? 0) === checkAt) {
      try {
        const since = new Date(Date.now() - 30 * 86400000).toISOString();
        const { data: past } = await admin
          .from("match_answers").select("match_id, answered_at, answer")
          .eq("player_id", profile.id).neq("match_id", matchId)
          .gte("answered_at", since).order("answered_at", { ascending: false }).limit(400);
        const byMatch = new Map<string, any[]>();
        for (const r of past ?? []) { const a = byMatch.get(r.match_id) ?? []; a.push(r); byMatch.set(r.match_id, a); }
        const lookup = analyzeLookup((mine ?? []) as any, [...byMatch.values()]);
        // DAC：正确率突然暴涨（平时 <60%，本局 ≥95%）→ 记录复核
        const { data: pastAcc } = await admin.from("match_answers").select("is_correct")
          .eq("player_id", profile.id).neq("match_id", matchId).gte("answered_at", since).limit(500);
        const pn = pastAcc?.length ?? 0;
        const pastRate = pn ? (pastAcc ?? []).filter((r: any) => r.is_correct).length / pn : 1;
        const curRate = (mine ?? []).filter((r: any) => r.is_correct).length / Math.max(1, mine?.length ?? 0);
        if (pn >= 30 && pastRate < 0.6 && curRate >= 0.95) {
          await admin.rpc("dac_flag", { p_profile_id: profile.id, p_source: "submit-answer", p_reason: "accuracy_spike",
            p_severity: "medium", p_meta: { matchId, pastRate: Math.round(pastRate * 100) / 100, curRate: Math.round(curRate * 100) / 100, pastSamples: pn } });
        }
        if (lookup.suspicious) {
          await admin.rpc("dac_flag", {
            p_profile_id: profile.id, p_source: "submit-answer", p_reason: "suspected_answer_lookup",
            p_severity: "medium", p_meta: { matchId, ...lookup, match_type: match.match_type, mode: match.mode },
          });
        }
      } catch (_) { /* 检测失败不影响答题 */ }
    }


}
