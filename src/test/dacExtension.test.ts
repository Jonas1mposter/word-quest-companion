import { describe, expect, it } from "vitest";
import { findExtensionResource, isExtensionUrl, isSyntheticInputViolation } from "@/lib/dacExtension";

describe("DAC 浏览器插件检测", () => {
  it("识别 Edge/Chrome/Firefox 扩展地址", () => {
    expect(isExtensionUrl("chrome-extension://abc/inject.js")).toBe(true);
    expect(isExtensionUrl("moz-extension://abc/a.js")).toBe(true);
    expect(isExtensionUrl("https://cdn.example.com/a.js")).toBe(false);
  });
  it("发现插件注入的脚本", () => {
    const d = document.createElement("div");
    d.innerHTML = '<script src="chrome-extension://xyz/solver.js"></script>';
    expect(findExtensionResource(d)).toContain("chrome-extension://xyz");
    expect(findExtensionResource(document.createElement("div"))).toBeNull();
  });
  it("脚本合成输入第2次判负", () => {
    expect(isSyntheticInputViolation(1)).toBe(false);
    expect(isSyntheticInputViolation(2)).toBe(true);
  });
});
