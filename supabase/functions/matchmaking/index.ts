import { z } from 'npm:zod@3.25.76';
import { requireProfile, json, corsHeaders } from '../_shared/auth.ts';

const Input = z.object({
  action: z.enum(['search', 'cancel', 'bots', 'tick']),
  requestId: z.string().uuid().optional(), matchId: z.string().uuid().optional(),
  mode: z.enum(['1v1', '2v2']).default('1v1'),
  matchType: z.enum(['ranked', 'free']).default('ranked'),
  subject: z.string().max(40).default('mixed'), partyId: z.string().uuid().nullable().optional(),
});

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    if (profile.banned_until && Date.parse(profile.banned_until) > Date.now()) return json({ error: 'Account banned' }, 403);
    const parsed = Input.safeParse(await req.json());
    if (!parsed.success) return json({ error: 'Invalid request' }, 400);
    const b = parsed.data;
    if (b.action === 'search' || b.action === 'cancel') {
      if (!b.requestId) return json({ error: 'Request ID required' }, 400);
      const { data, error } = await admin.rpc('matchmaking_action', {
        p_profile_id: profile.id, p_request_id: b.requestId, p_mode: b.mode,
        p_type: b.matchType, p_subject: b.subject, p_party_id: b.partyId ?? null,
        p_cancel: b.action === 'cancel',
      });
      if (error) return json({ error: error.message }, 409);
      return json(data);
    }
    if (!b.matchId) return json({ error: 'Match ID required' }, 400);
    const { data: m } = await admin.from('ranked_matches').select('player1_id,player2_id,player3_id,player4_id').eq('id', b.matchId).single();
    if (!m || ![m.player1_id, m.player2_id, m.player3_id, m.player4_id].includes(profile.id)) return json({ error: 'Not in match' }, 403);
    if (b.action === 'bots') {
      const { data, error } = await admin.from('match_bot_state').select('bot_slots').eq('match_id', b.matchId).maybeSingle();
      if (error) return json({ error: 'Unable to load bots' }, 500);
      return json({ bots: data });
    }
    const { data, error } = await admin.rpc('tick_match_bots', { p_match_id: b.matchId, p_profile_id: profile.id });
    if (error) return json({ error: error.message }, 409);
    return json(data ?? { ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: 'Request failed' }, 500);
  }
});