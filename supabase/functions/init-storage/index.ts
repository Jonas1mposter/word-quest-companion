import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const buckets = [
    { id: "profile-backgrounds", public: true },
  ];
  const results: any[] = [];
  for (const b of buckets) {
    const { data: existing } = await admin.storage.getBucket(b.id);
    if (existing) {
      const { error } = await admin.storage.updateBucket(b.id, {
        public: b.public,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      });
      results.push({ id: b.id, action: "updated", error: error?.message });
    } else {
      const { error } = await admin.storage.createBucket(b.id, {
        public: b.public,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
      });
      results.push({ id: b.id, action: "created", error: error?.message });
    }
  }
  return new Response(JSON.stringify({ ok: true, results }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
