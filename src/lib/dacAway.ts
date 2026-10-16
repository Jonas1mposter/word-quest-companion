/**
 * DAC 切屏判负规则：对局中连续离开页面的宽限时长。
 * 超过这个时间没回来（或回来时已经超时），本局直接判负。
 */
export const AWAY_LIMIT_MS = 60000;

/** 连续离开多久算违规（含正好到点）。 */
export const isAwayViolation = (awayMs: number): boolean => awayMs >= AWAY_LIMIT_MS;

/** 对局中累计切屏达到这个次数，直接踢出对局判负。 */
export const SWITCH_LIMIT = 3;
export const isSwitchViolation = (count: number): boolean => count >= SWITCH_LIMIT;
