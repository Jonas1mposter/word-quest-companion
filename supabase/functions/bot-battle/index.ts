import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';
import { requireProfile, json } from '../_shared/auth.ts';
import { battleAudioResponse } from '../_shared/battleAudio.ts';
import { listeningAudio } from '../_shared/listeningAudio.ts';
import { analyzeTiming } from '../_shared/answerTiming.ts';

const Request = z.object({
  sessionId: z.string().uuid(), action: z.enum(['start', 'question', 'answer', 'finish', 'forfeit', 'audio']),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(), questionIndex: z.number().int().min(0).max(9).optional(),
  answer: z.string().max(2000).optional(),
  reason: z.enum(['tab_switch_limit', 'background_away', 'webdriver', 'robotic_mouse', 'synthetic_click', 'synthetic_input']).optional(),
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
    if (body.action === 'finish') {
      // DAC：人机局同样检测固定节奏与超人速度，仅记录供管理员复核
      try {
        const { data: s } = await admin.from('bot_battle_sessions').select('answers, difficulty').eq('id', body.sessionId).eq('profile_id', profile.id).maybeSingle();
        const rows = ((s?.answers ?? []) as any[]).map((a) => ({ answered_at: a.answeredAt, answer: a.answer, correct: a.response?.isCorrect === true }));
        const timing = analyzeTiming(rows);
        const fast = rows.filter((r, i) => i > 0 && r.correct && new Date(r.answered_at).getTime() - new Date(rows[i - 1].answered_at).getTime() < 1200).length;
        if (timing.robotic) await admin.rpc('dac_flag', { p_profile_id: profile.id, p_source: 'bot-battle', p_reason: 'fixed_answer_timing', p_severity: 'high', p_meta: { sessionId: body.sessionId, mode: 'bot', ...timing } });
        if (fast >= 3) await admin.rpc('dac_flag', { p_profile_id: profile.id, p_source: 'bot-battle', p_reason: 'impossible_answer_speed', p_severity: 'high', p_meta: { sessionId: body.sessionId, mode: 'bot', fastCorrect: fast } });
      } catch (_) { /* 检测失败不影响结算 */ }
    }
    if (body.action !== 'audio') return json(data);
    if (typeof data?.target !== 'string') return json({ error: 'Audio unavailable' }, 403);
    // Fetch recordings server-side. Provider URLs and hidden listening words never reach the browser.
    return battleAudioResponse(await listeningAudio(data.target), corsHeaders);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: 'Request failed' }, 500);
  }
});