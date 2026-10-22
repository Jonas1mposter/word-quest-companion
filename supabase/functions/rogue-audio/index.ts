import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";
import { listeningAudio } from "../_shared/listeningAudio.ts";
import { battleAudioResponse } from "../_shared/battleAudio.ts";

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const body = await req.json();
    if (typeof body.runId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.runId) || !Number.isInteger(body.index) || body.index < 0) return json({ error: "Invalid request" }, 400);
    const { data, error } = await admin.rpc("rogue_audio_target", { p_profile: profile.id, p_run: body.runId, p_index: body.index });
    if (error || typeof data !== "string") return json({ error: "听力题不可用" }, 403);
    return battleAudioResponse(await listeningAudio(data), corsHeaders);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "发音加载失败，请点击重试" }, 500);
  }
});