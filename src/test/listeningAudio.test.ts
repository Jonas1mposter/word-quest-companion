import { describe, expect, it, vi } from "vitest";
import { listeningAudio } from "../../supabase/functions/_shared/listeningAudio";

const recording = () => { const bytes = new Uint8Array(600); bytes.set([0xff, 0xfb, 0x90]); return new Response(bytes); };
describe("听力服务端发音备用来源", () => {
  it("两种录音失败后用服务端机器读音，只返回字节", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("offline", { status: 503 })).mockResolvedValueOnce(new Response("missing", { status: 404 })).mockResolvedValueOnce(recording());
    expect((await listeningAudio("Apple (n.)", fetcher)).byteLength).toBe(600);
    expect(fetcher.mock.calls[2][0]).toContain("translate_tts");
  });
  it("拒绝伪装为成功音频的错误页面，改试下一来源", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("x".repeat(800), { headers: { "Content-Type": "audio/mpeg" } })).mockResolvedValueOnce(recording());
    expect((await listeningAudio("pear", fetcher)).byteLength).toBe(600);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});