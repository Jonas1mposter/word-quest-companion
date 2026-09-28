import { corsHeaders, requireProfile, json } from "../_shared/auth.ts";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_code: "兑换码不存在",
  code_disabled: "兑换码已停用",
  code_expired: "兑换码已过期",
  code_used_up: "兑换码已被领完",
  already_redeemed: "你已经兑换过这个码了",
  no_profile: "找不到玩家档案",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { admin, userId } = await requireProfile(req);
    const body = await req.json().catch(() => ({}));
    const code = body?.code;
    if (typeof code !== "string" || code.trim().length === 0 || code.length > 64) {
      return json({ ok: false, error: "invalid_input", message: "请输入兑换码" }, 400);
    }

    const { data, error } = await admin.rpc("redeem_code", {
      p_user_id: userId,
      p_code: code.trim(),
    });
    if (error) return json({ ok: false, error: "server_error", message: "兑换失败，请稍后重试" }, 500);

    if (!data?.ok) {
      return json({ ok: false, error: data?.error, message: ERROR_MESSAGES[data?.error] ?? "兑换失败" }, 200);
    }

    return json({
      ok: true,
      rewardType: data.reward_type,
      rewardValue: data.reward_value,
      message: data.reward_type === "coins" ? `成功兑换 ${data.reward_value} 狄邦豆！` : "兑换成功！",
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return json({ ok: false, error: "server_error", message: String(e) }, 500);
  }
});
