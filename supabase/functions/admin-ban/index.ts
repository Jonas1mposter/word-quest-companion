import { corsHeaders, json, requireProfile } from "../_shared/auth.ts";

// hours: number of hours, or null = permanent, 0 = unban
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { admin, userId } = await requireProfile(req);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const profileId = String(body.profile_id || "");
    const hours = body.hours === null ? null : Number(body.hours);
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : null;
    if (!/^[0-9a-f-]{36}$/i.test(profileId)) return json({ error: "invalid profile_id" }, 400);
    if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 87600)) return json({ error: "invalid hours" }, 400);

    const { data: target } = await admin.from("profiles").select("user_id, username").eq("id", profileId).single();
    if (!target) return json({ error: "profile not found" }, 404);
    if (target.user_id === userId) return json({ error: "不能封禁自己" }, 400);

    const permanent = hours === null;
    const banDuration = hours === 0 ? "none" : permanent ? "876000h" : `${hours}h`;
    const { error: aErr } = await admin.auth.admin.updateUserById(target.user_id, { ban_duration: "none" } as any);
    if (aErr) return json({ error: aErr.message }, 500);

    const until = hours === 0 ? null : new Date(Date.now() + (permanent ? 876000 : hours!) * 3600_000).toISOString();
    await admin.from("profiles").update({ banned_until: until, ban_reason: hours === 0 ? null : reason }).eq("id", profileId);
    if (hours !== 0) await admin.from("match_queue").delete().eq("profile_id", profileId);

    return json({ ok: true, banned_until: until, permanent });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ error: String(e) }, 500);
  }
});
