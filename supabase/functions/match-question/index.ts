import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.25.76";
import { requireProfile, json } from "../_shared/auth.ts";

const RequestSchema = z.object({ matchId: z.string().uuid() });
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Bad request" }, 400);
    if (profile.banned_until && new Date(profile.banned_until).getTime() > Date.now()) return json({ error: "Account banned" }, 403);
    const { data, error } = await admin.rpc("match_next_question", {
      p_match_id: parsed.data.matchId, p_profile_id: profile.id,
    });
    if (error) return json({ error: error.message }, 403);
    return json(data);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "Unable to load question" }, 500);
  }
});