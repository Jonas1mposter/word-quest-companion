import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { BanInfo } from "@/components/BanScreen";

// Realtime is a notification only; always read the caller's persisted row.
export function useLiveBan(userId: string | undefined, onBan: (info: BanInfo) => void) {
  const callback = useRef(onBan);
  callback.current = onBan;
  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    let checking = false;
    let blocked = false;
    let request: AbortController | undefined;
    const check = async () => {
      if (stopped || checking || blocked || !navigator.onLine) return;
      checking = true;
      request = new AbortController();
      const timeout = window.setTimeout(() => request?.abort(), 5000);
      try {
        const { data, error } = await supabase.from("profiles")
          .select("id, username, banned_until, ban_reason").eq("user_id", userId)
          .abortSignal(request.signal).single();
        if (stopped || error || !data?.banned_until) return;
        if (Date.parse(data.banned_until) > Date.now()) {
          blocked = true;
          callback.current({ profileId: data.id, username: data.username,
            bannedUntil: data.banned_until, reason: data.ban_reason });
        }
      } catch {
        // A dropped notification or failed read is retried by the watchdog.
      } finally {
        window.clearTimeout(timeout);
        checking = false;
      }
    };
    const recheck = () => { void check(); };
    const visible = () => { if (document.visibilityState === "visible") recheck(); };
    const channel = supabase.channel(`account-ban-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${userId}` }, recheck)
      .subscribe(recheck);
    recheck();
    const interval = window.setInterval(recheck, 10000);
    window.addEventListener("online", recheck);
    window.addEventListener("focus", recheck);
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      request?.abort();
      window.clearInterval(interval);
      window.removeEventListener("online", recheck);
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", visible);
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}