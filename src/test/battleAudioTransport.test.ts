// @vitest-environment node
import { describe, expect, it } from "vitest";
import { FunctionsClient } from "@supabase/functions-js";
import { battleAudioResponse } from "../../supabase/functions/_shared/battleAudio";

describe("听力二进制传输", () => {
  it.each([
    ["MP3", [0xff, 0xfb, 0x90, 0x00, 0x80, 0xfe]],
    ["WAV", [0x52, 0x49, 0x46, 0x46, 0xff, 0x80]],
  ])("%s通过真实Supabase解析器后字节不变", async (_format, values) => {
    const bytes = new Uint8Array(values as number[]);
    const response = battleAudioResponse(bytes.buffer, {});
    const client = new FunctionsClient("https://example.invalid/functions/v1", {
      customFetch: async () => response,
    });
    const { data, error } = await client.invoke("match-audio", {
      body: { matchId: "opaque-match", questionIndex: 3 },
    });
    expect(error).toBeNull();
    expect(data).toBeInstanceOf(Blob);
    expect(Array.from(new Uint8Array(await data.arrayBuffer()))).toEqual(values);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});