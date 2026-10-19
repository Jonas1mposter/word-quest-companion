import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { requireProfile, json } from '../_shared/auth.ts';
import { battleAudioResponse } from '../_shared/battleAudio.ts';

const Request = z.object({
  sessionId: z.string().uuid(), action: z.enum(['start', 'question', 'answer', 'finish', 'forfeit', 'audio']),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(), questionIndex: z.number().int().min(0).max(9).optional(),
  answer: z.string().max(2000).optional(),
  reason: z.enum(['tab_switch_limit', 'background_away', 'webdriver', 'robotic_mouse', 'synthetic_click']).optional(),
  meta: z.record(z.number().finite()).optional(),
});
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const parsed = Request.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Invalid request' }, 400);
    const body = parsed.data;
    const { data, error } = await admin.rpc('bot_battle_action', {
      p_profile_id: profile.id, p_session_id: body.sessionId, p_action: body.action,
      p_difficulty: body.difficulty ?? 'medium', p_index: body.questionIndex ?? null,
      p_answer: body.answer ?? '', p_reason: body.reason ?? null, p_meta: body.meta ?? {},
    });
    if (error) return json({ error: error.message }, 409);
    if (body.action !== 'audio') return json(data);
    if (typeof data?.target !== 'string') return json({ error: 'Audio unavailable' }, 403);
    // Fetch recordings server-side. Provider URLs and hidden listening words never reach the browser.
    const text = data.target.toLowerCase().replace(/[(（][^)）]*[)）]/g, ' ').split('/')[0].trim();
    for (const type of [2, 1]) {
      try {
        const audio = await fetch(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`, { signal: AbortSignal.timeout(6000) });
        if (!audio.ok || !(audio.headers.get('content-type') ?? '').includes('audio')) continue;
        const bytes = await audio.arrayBuffer();
        if (bytes.byteLength > 512) return battleAudioResponse(bytes, corsHeaders);
      } catch { /* Try the other recording. Never synthesize hidden words on the client. */ }
    }
    return json({ error: 'Audio unavailable, please retry' }, 503);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: 'Request failed' }, 500);
  }
});