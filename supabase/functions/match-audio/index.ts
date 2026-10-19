import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { requireProfile, json } from "../_shared/auth.ts";
import { battleAudioResponse } from "../_shared/battleAudio.ts";

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
    // Never redirect or return provider URLs: their query strings contain the answer.
    const text = target.toLowerCase().replace(/[(（][^)）]*[)）]/g, " ").split("/")[0].trim();
    let bytes: ArrayBuffer | null = null;
    try {
      const audio = await fetch(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`, { signal: AbortSignal.timeout(6000) });
      if (audio.ok && (audio.headers.get("content-type") ?? "").includes("audio")) {
        const candidate = await audio.arrayBuffer();
        if (candidate.byteLength > 512) bytes = candidate;
      }
    } catch { /* Use the existing authenticated TTS fallback below. */ }
    if (!bytes) {
      const url = Deno.env.get("SUPABASE_URL");
      if (!url) return json({ error: "Audio unavailable, please retry" }, 503);
      const generated = await fetch(`${url}/functions/v1/word-tts`, {
        method: "POST", headers: { Authorization: req.headers.get("Authorization") ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ text, accent: "us" }), signal: AbortSignal.timeout(20000),
      });
      const result = await generated.json();
      if (!generated.ok || typeof result.url !== "string") return json({ error: "Audio unavailable, please retry" }, 503);
      const audio = await fetch(result.url, { signal: AbortSignal.timeout(6000) });
      if (!audio.ok) return json({ error: "Audio unavailable, please retry" }, 503);
      bytes = await audio.arrayBuffer();
    }
    return battleAudioResponse(bytes, corsHeaders);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Audio unavailable, please retry" }, 503);
  }
});