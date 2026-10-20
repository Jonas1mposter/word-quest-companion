// Provider requests stay server-side: neither hidden text nor provider URLs reach the client.
export async function listeningAudio(text: string, fetcher: typeof fetch = fetch): Promise<ArrayBuffer> {
  const cleaned = text.toLowerCase().replace(/[(（][^)）]*[)）]/g, " ").split("/")[0].trim();
  const sources = [
    `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleaned)}&type=2`,
    `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(cleaned)}&type=1`,
    `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(cleaned)}`,
  ];
  for (const source of sources) {
    try {
      const response = await fetcher(source, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) continue;
      const bytes = await response.arrayBuffer();
      const header = new Uint8Array(bytes);
      const mp3 = (header[0] === 0xff && (header[1] & 0xe0) === 0xe0) || (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33);
      const wav = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46;
      if (bytes.byteLength > 512 && (mp3 || wav)) return bytes;
    } catch { /* Try the next recording or server-side speech source. */ }
  }
  throw new Error("Audio unavailable, please retry");
}