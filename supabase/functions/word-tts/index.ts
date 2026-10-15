// AI 单词发音（有道没有发音时的兜底）。生成一次后存入 word-audio 桶，之后复用。
import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

const MODEL = "google/gemini-3.1-flash-tts-preview";
const VOICE = { us: "Kore", uk: "Kore" } as const;

async function sha1(s: string) {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin } = await requireProfile(req);
    const body = await req.json().catch(() => ({}));
    const text = String(body?.text ?? "").trim().slice(0, 120);
    const accent = body?.accent === "uk" ? "uk" : "us";
    if (!text || !/[a-z]/i.test(text)) return json({ error: "Bad text" }, 400);

    const path = `${accent}/${await sha1(text.toLowerCase())}.wav`;
    const bucket = admin.storage.from("word-audio");

    const existing = await bucket.createSignedUrl(path, 86400);
    if (existing.data?.signedUrl) return json({ url: existing.data.signedUrl, cached: true });

    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI not configured" }, 500);
    const accentName = accent === "uk" ? "British English (Received Pronunciation)" : "General American English";
    const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        contents: [{ role: "user", parts: [{ text: `Pronounce the following clearly, exactly once, in a standard ${accentName} accent, like a dictionary recording: ${text}` }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE[accent] } } },
        },
        stream_format: "audio",
      }),
    });
    if (!r.ok) {
      const details = await r.text();
      console.error(`TTS failed [${r.status}]: ${details}`);
      return json({ error: "TTS failed", status: r.status, details }, r.status);
    }
    const audio = new Uint8Array(await r.arrayBuffer());
    const up = await bucket.upload(path, audio, { contentType: "audio/wav", upsert: true });
    if (up.error) console.error("upload failed", up.error.message);
    const signed = await bucket.createSignedUrl(path, 86400);
    if (signed.data?.signedUrl) return json({ url: signed.data.signedUrl, cached: false });
    return json({ error: "Store failed" }, 500);
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
