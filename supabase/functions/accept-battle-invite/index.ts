import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { requireProfile, json } from "../_shared/auth.ts";
const RequestSchema = z.object({ inviteId: z.string().uuid() });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Bad request" }, 400);
    const { data, error } = await admin.rpc("accept_battle_invite", { p_invite_id: parsed.data.inviteId, p_profile_id: profile.id });
    if (error) return json({ error: error.message }, 409);
    return json({ matchId: data });
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Unable to accept invite" }, 500);
  }
});