/**
 * DAC 浏览器插件检测（Edge/Chrome 扩展会以 content script 注入页面）。
 * 只看页面内能确认的证据：扩展资源注入、被改写的原生网络函数、脚本合成的输入事件。
 */
const EXT_URL = /^(chrome|moz|ms-browser|safari-web|edge)-extension:\/\//i;

export const isExtensionUrl = (url: string | null | undefined): boolean => !!url && EXT_URL.test(url.trim());

/** 节点本身或其子节点是否带有扩展资源（script/iframe/img/link/style 引用）。 */
export function findExtensionResource(root: ParentNode | Element): string | null {
  const els: Element[] = [];
  if (root instanceof Element) els.push(root);
  root.querySelectorAll?.("script[src],iframe[src],img[src],link[href],embed[src],object[data]").forEach((e) => els.push(e));
  for (const el of els) {
    const url = el.getAttribute("src") || el.getAttribute("href") || el.getAttribute("data");
    if (isExtensionUrl(url)) return url!.slice(0, 120);
  }
  if (root instanceof HTMLStyleElement && /(chrome|moz|edge)-extension:\/\//i.test(root.textContent || "")) return "style";
  return null;
}

const isNative = (fn: unknown): boolean => {
  try { return typeof fn === "function" && /\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(fn)); }
  catch { return true; }
};

/** 被插件改写（用于偷看/篡改对局请求）的原生函数名单。 */
export function tamperedNatives(w: Window & typeof globalThis = window): string[] {
  const list: [string, unknown][] = [
    ["fetch", w.fetch],
    ["XMLHttpRequest.open", w.XMLHttpRequest?.prototype?.open],
    ["XMLHttpRequest.send", w.XMLHttpRequest?.prototype?.send],
    ["Function.toString", Function.prototype.toString],
  ];
  return list.filter(([, f]) => f !== undefined && !isNative(f)).map(([n]) => n);
}

/** 合成（脚本发出）的键盘/输入事件达到这个次数判负。 */
export const SYNTHETIC_INPUT_LIMIT = 2;
export const isSyntheticInputViolation = (n: number) => n >= SYNTHETIC_INPUT_LIMIT;
