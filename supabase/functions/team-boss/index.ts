import { z } from "npm:zod@3.25.76";
import { corsHeaders, json, requireProfile } from "../_shared/auth.ts";

const Input = z.object({
  action: z.enum(["resume", "create", "join", "state", "leave", "role", "ready", "start", "answer", "act"]),
  run: z.string().uuid().optional(), round: z.number().int().min(1).max(25).optional(),
  choice: z.string().max(500).optional(), target: z.string().uuid().optional(),
});
Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, profile } = await requireProfile(req);
    const parsed = Input.safeParse(await req.json());
    if (!parsed.success) return json({ error: "操作无效" }, 400);
    const b = parsed.data;
    const { data, error } = await admin.rpc("team_boss_dispatch", {
      p_profile: profile.id, p_action: b.action, p_run: b.run ?? null,
      p_round: b.round ?? null, p_choice: b.choice ?? null, p_target: b.target ?? null,
    });
    if (error) return json({ error: error.message }, 409);
    return json(data);
  } catch (error) {
    if (error instanceof Response) return error;
    return json({ error: "请求未能确认，请重试" }, 500);
  }
});