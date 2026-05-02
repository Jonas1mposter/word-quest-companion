import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN = `${SUPABASE_URL}/functions/v1/claim-milestone-reward`;

Deno.test("rejects request without Authorization header", async () => {
  const res = await fetch(FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({ milestoneId: "x" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "unauthorized");
});

Deno.test("rejects invalid JWT", async () => {
  const res = await fetch(FN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: "Bearer invalid.jwt.token",
    },
    body: JSON.stringify({ milestoneId: "x" }),
  });
  await res.text();
  assertEquals(res.status, 401);
});

Deno.test("CORS preflight returns 200", async () => {
  const res = await fetch(FN, { method: "OPTIONS" });
  await res.text();
  assertEquals(res.status, 200);
});
