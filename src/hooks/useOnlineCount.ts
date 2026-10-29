import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Shared presence room: counts distinct signed-in players currently on the site. */
export function useOnlineCount(userId: string | null | undefined) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel("online-players", { config: { presence: { key: userId } } });
    const sync = () => setCount(Object.keys(channel.presenceState()).length);
    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") await channel.track({ at: Date.now() });
      });
    return () => { supabase.removeChannel(channel); };
  }, [userId]);
  return count;
}
