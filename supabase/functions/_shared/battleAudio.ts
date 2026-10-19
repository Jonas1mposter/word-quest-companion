// Supabase FunctionsClient only preserves binary bodies for octet-stream/PDF.
// Audio MIME types otherwise go through response.text(), corrupting the bytes.
export function battleAudioResponse(bytes: ArrayBuffer, cors: Record<string, string>) {
  return new Response(bytes, {
    headers: { ...cors, "Content-Type": "application/octet-stream", "Cache-Control": "no-store" },
  });
}