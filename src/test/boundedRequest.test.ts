import { describe, expect, it, vi } from "vitest";
import { boundedRequest } from "@/lib/boundedRequest";
describe("对局信息等待有界", () => {
  it("10秒无响应结束等待而不是永久卡在找到对手", async () => {
    vi.useFakeTimers();
    try {
      const pending = boundedRequest(new Promise(() => {}));
      const assertion = expect(pending).rejects.toThrow("对局加载失败");
      await vi.advanceTimersByTimeAsync(10000);
      await assertion;
    } finally { vi.useRealTimers(); }
  });
});