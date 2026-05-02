import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

// Increment a daily quest's progress by N. Server caps at quest.target and
// flips completed=true when reached. Cannot mark claimed=true (use claim-quest-reward).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const { questType, amount = 1 } = await req.json();
    if (typeof questType !== "string" || typeof amount !== "number" || amount <= 0 || amount > 100) {
      return json({ error: "Bad request" }, 400);
    }

    const { data: quest } = await admin
      .from("daily_quests")
      .select("*")
      .eq("quest_type", questType)
      .eq("is_active", true)
      .maybeSingle();
    if (!quest) return json({ ok: true, skipped: true });

    const today = new Date().toISOString().split("T")[0];
    const { data: prog } = await admin
      .from("user_quest_progress")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("quest_id", quest.id)
      .eq("quest_date", today)
      .maybeSingle();

    const currentProgress = prog?.progress ?? 0;
    const newProgress = Math.min(quest.target, currentProgress + amount);
    const completed = newProgress >= quest.target;

    if (prog) {
      await admin
        .from("user_quest_progress")
        .update({ progress: newProgress, completed })
        .eq("id", prog.id);
    } else {
      await admin.from("user_quest_progress").insert({
        profile_id: profile.id,
        quest_id: quest.id,
        quest_date: today,
        progress: newProgress,
        completed,
        claimed: false,
      });
    }

    return json({ ok: true, progress: newProgress, completed });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
