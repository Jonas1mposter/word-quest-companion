import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { requireProfile, json } from '../_shared/auth.ts';

// Retire the untrusted client-result payout path, including old clients and direct requests.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    await requireProfile(req);
    return json({ error: '请刷新页面，使用服务器校验的人机对战；旧版结果不能领取奖励。' }, 410);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: 'Request failed' }, 500);
  }
});
