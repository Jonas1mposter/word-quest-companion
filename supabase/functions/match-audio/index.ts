import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { requireProfile, json } from "../_shared/auth.ts";
import { battleAudioResponse } from "../_shared/battleAudio.ts";
import { listeningAudio } from "../_shared/listeningAudio.ts";

const RequestSchema = z.object({ matchId: z.string().uuid(), questionIndex: z.number().int().min(0).max(999) });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Bad request" }, 400);
    if (profile.banned_until && new Date(profile.banned_until).getTime() > Date.now()) return json({ error: "Account banned" }, 403);
    const { data: target, error } = await admin.rpc("match_listening_word", {
      p_match_id: parsed.data.matchId, p_profile_id: profile.id, p_question_index: parsed.data.questionIndex,
    });
    if (error || typeof target !== "string") return json({ error: "Audio not available for this question" }, 403);
    const bytes = await listeningAudio(target);
    return battleAudioResponse(bytes, corsHeaders);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Audio unavailable, please retry" }, 503);
  }
});