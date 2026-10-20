// Absence and surrender are not evidence of automation. Unknown client claims
// are review-only, never advertised to an opponent as confirmed script use.
export function classifyForfeit(reason: unknown) {
  if (reason === "tab_switch_limit" || reason === "background_away") {
    return { source: "match_absence", severity: "medium", reason: "对局离开页面超出限制，已判负（不代表使用脚本）" };
  }
  if (reason === "surrender") return { source: "match_surrender", severity: "low", reason: "主动退赛" };
  return { source: "client_report", severity: "medium", reason: "客户端报告异常操控，已退赛，待管理员复核" };
}