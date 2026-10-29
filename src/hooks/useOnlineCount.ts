import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const OnlineCountContext = createContext<number | null>(null);

/** One site-wide connection, not one connection per visible counter. */
export function useOnlinePresence(userId: string | null | undefined) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    setCount(null);
    if (!userId) return;
    let active = true;
    const channel = supabase.channel("online-players", { config: { presence: { key: userId } } });
    const sync = () => {
      if (active) setCount(Object.keys(channel.presenceState()).length);
    };
    channel
      .on("presence", { event: "sync" }, sync)
      .subscribe(async (status) => {
        if (!active) return;
        if (status === "SUBSCRIBED") {
          try {
            const result = await channel.track({ at: Date.now() });
            if (active && result !== "ok") setCount(null);
          } catch {
            if (active) setCount(null);
          }
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setCount(null);
        }
      });
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);
  return userId ? count : null;
}

export function OnlineCountProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const count = useOnlinePresence(user?.id);
  return createElement(OnlineCountContext.Provider, { value: count }, children);
}

export function useOnlineCount() {
  return useContext(OnlineCountContext);
}
