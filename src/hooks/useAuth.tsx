import { showBanScreen, type BanInfo } from "@/components/BanScreen";
import { useState, useEffect, useRef, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveBan } from "@/hooks/useLiveBan";
import { boundedRequest } from "@/lib/boundedRequest";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  grade: number;
  level: number;
  xp: number;
  xp_to_next_level: number;
  coins: number;
  energy: number;
  max_energy: number;
  streak: number;
  rank_tier: string;
  rank_stars: number;
  rank_points: number;
  wins: number;
  losses: number;
  avatar_url: string | null;
  class: string | null;
  elo_rating: number;
  elo_free: number;
  free_match_wins: number;
  free_match_losses: number;
  last_energy_restore: string | null;
  total_xp?: number;
  max_combo?: number;
  background_type?: string;
  background_value?: string;
}

interface User {
  id: string;
  email?: string;
}

interface Session {
  user: User;
  access_token: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  loadingError: string | null;
  retryLoading: () => Promise<void>;
  gradeAutoDetected: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [gradeAutoDetected, setGradeAutoDetected] = useState(true);
  const blockedUser = useRef<string | null>(null);
  const loadGeneration = useRef(0);
  const activeUser = useRef<string | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const enforceBan = (info: BanInfo, userId: string) => {
    if (blockedUser.current === userId) return;
    blockedUser.current = userId;
    loadGeneration.current++;
    activeUser.current = null;
    setLoadingError(null);
    showBanScreen(info);
    setUser(null);
    setSession(null);
    setProfile(null);
    setLoading(false);
    void supabase.auth.signOut({ scope: "local" });
  };
  useLiveBan(user?.id, (info) => { if (user) enforceBan(info, user.id); });

  const detectGradeFromEmail = (email: string): number | null => {
    const lower = email.toLowerCase();
    if (lower.includes('grade_8')) return 8;
    if (lower.includes('grade_7')) return 7;
    return null;
  };

  const fetchGraphProfile = async (providerToken: string): Promise<{ displayName: string | null; grade: number | null }> => {
    let displayName: string | null = null;
    let grade: number | null = null;

    try {
      // Fetch basic profile info
      const meRes = await boundedRequest(fetch('https://graph.microsoft.com/v1.0/me?$select=displayName', {
        headers: { 'Authorization': `Bearer ${providerToken}` }
      }), 5000);
      if (meRes.ok) {
        const meData = await meRes.json();
        displayName = meData.displayName || null;
      }

      // Fetch group memberships for grade detection
      const groupsRes = await boundedRequest(fetch('https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName', {
        headers: { 'Authorization': `Bearer ${providerToken}` }
      }), 5000);
      if (groupsRes.ok) {
        const groupsData = await groupsRes.json();
        if (groupsData.value) {
          for (const group of groupsData.value) {
            const name = (group.displayName || '').toLowerCase();
            if (name.includes('grade_8')) { grade = 8; break; }
            if (name.includes('grade_7')) { grade = 7; break; }
          }
        }
      } else {
        console.warn('Graph API groups fetch failed:', groupsRes.status);
      }
    } catch (err) {
      console.error('Error fetching Graph API data:', err);
    }

    return { displayName, grade };
  };

  const fetchGraphAvatar = async (providerToken: string): Promise<string | null> => {
    try {
      const photoRes = await boundedRequest(fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: { 'Authorization': `Bearer ${providerToken}` }
      }), 5000);
      if (!photoRes.ok) return null;

      const blob = await photoRes.blob();
      if (blob.size === 0) return null;

      // Upload to Supabase storage
      const fileName = `microsoft_${Date.now()}.jpg`;
      const { error: uploadError } = await boundedRequest(supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true }), 5000);

      if (uploadError) {
        console.warn('Avatar upload failed:', uploadError);
        return null;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      return urlData.publicUrl;
    } catch (err) {
      console.warn('Error fetching Graph avatar:', err);
      return null;
    }
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await boundedRequest(supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single(), 10000);

    if (error) {
      console.error("Error fetching profile:", error);
      throw new Error("账号资料加载失败，请重试");
    }
    if (!data) throw new Error("账号资料加载失败，请重试");

    const bu = data?.banned_until;
    if (data && bu && new Date(bu) > new Date()) {
      enforceBan({ profileId: data.id, username: data.username, bannedUntil: bu, reason: data.ban_reason }, userId);
      return null;
    }

    if (data) {
      // Check daily energy restore
      const today = new Date().toISOString().split('T')[0];
      if (!data.last_energy_restore || data.last_energy_restore < today) {
        try {
          const { data: updated, error: restoreError } = await boundedRequest(supabase.rpc("restore_daily_energy"), 5000);
          if (restoreError) throw restoreError;
          return (updated ?? data) as Profile;
        } catch (error) {
          console.error("Error restoring daily energy:", error);
          return data as Profile;
        }
      }
    }

    return data as Profile | null;
  };

  const refreshProfile = async () => {
    const userId = activeUser.current;
    const generation = loadGeneration.current;
    if (!userId) return;
    try {
      const p = await fetchProfile(userId);
      if (activeUser.current === userId && generation === loadGeneration.current && blockedUser.current !== userId) {
        setProfile(p);
        setLoadingError(null);
      }
    } catch (error) { console.error("Error refreshing profile:", error); }
  };

  const enrichProfile = async (p: Profile, session: any, isCurrent: () => boolean) => {
    const isSignIn = true;
    try {
              const updates: Record<string, any> = {};

              const userPicked = !!(p as any).grade_selected_at;
              if (isSignIn && session.provider_token) {
                // Fetch displayName + grade from Graph API
                const { displayName, grade: detectedGrade } = await fetchGraphProfile(session.provider_token);

                // Sync display name (only if current username looks auto-generated)
                if (displayName && (p.username === p.user_id.split('-')[0] || p.username.startsWith('user_') || p.username === session.user.email?.split('@')[0])) {
                  updates.username = displayName;
                }

                // Sync avatar if user doesn't have one yet
                if (!p.avatar_url) {
                  const avatarUrl = await fetchGraphAvatar(session.provider_token);
                  if (avatarUrl) {
                    updates.avatar_url = avatarUrl;
                  }
                }

                // Grade detection from Azure groups
                if (detectedGrade) {
                  setGradeAutoDetected(true);
                  if (!userPicked && p.grade !== detectedGrade) {
                    updates.grade = detectedGrade;
                  }
                } else {
                  // Fallback to email-based detection
                  const emailGrade = session.user.email ? detectGradeFromEmail(session.user.email) : null;
                  if (emailGrade) {
                    setGradeAutoDetected(true);
                    if (!userPicked && p.grade !== emailGrade) updates.grade = emailGrade;
                  } else {
                    setGradeAutoDetected(false);
                  }
                }
              } else if (isSignIn) {
                // No provider token, fallback to email
                const emailGrade = session.user.email ? detectGradeFromEmail(session.user.email) : null;
                if (emailGrade) {
                  setGradeAutoDetected(true);
                  if (!userPicked && p.grade !== emailGrade) updates.grade = emailGrade;
                } else {
                  setGradeAutoDetected(false);
                }
              }
              // On non-SIGNED_IN events (token refresh etc.), keep gradeAutoDetected as-is

              // Apply all updates in one query
              if (!isCurrent()) return;
              if (Object.keys(updates).length > 0) {
                const { data: updated } = await boundedRequest(supabase
                  .from("profiles")
                  .update(updates)
                  .eq("id", p.id)
                  .select()
                  .single(), 5000);
                if (updated) {
                  if (!isCurrent()) return;
                  setProfile(updated as Profile);
                  return;
                }
              }
    } catch (error) { console.warn("Optional Microsoft sync failed:", error); }
  };

  const loadSessionProfile = async (nextSession: any, event = "INITIAL_SESSION") => {
    const generation = ++loadGeneration.current;
    const userId = nextSession?.user?.id ?? null;
    activeUser.current = userId;
    if (userId && blockedUser.current === userId) return;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setLoadingError(null);
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const isCurrent = () => generation === loadGeneration.current && activeUser.current === userId && blockedUser.current !== userId;
    try {
      const p = await fetchProfile(userId);
      if (!isCurrent()) return;
      setProfile(p);
      setLoading(false);
      if (p && event === "SIGNED_IN") void enrichProfile(p, nextSession, isCurrent);
    } catch (error) {
      if (!isCurrent()) return;
      console.error("Profile startup failed:", error);
      setLoadingError("账号资料加载失败，请重试");
      setLoading(false);
    }
  };

  const retryLoading = async () => {
    setLoading(true);
    setLoadingError(null);
    const generation = loadGeneration.current;
    try {
      const { data, error } = await boundedRequest(supabase.auth.getSession(), 10000);
      if (generation !== loadGeneration.current) return;
      if (error) throw error;
      await loadSessionProfile(data.session);
    } catch (error) {
      if (generation !== loadGeneration.current) return;
      console.error("Session startup failed:", error);
      setLoadingError("登录状态加载失败，请重试");
      setLoading(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    let receivedAuthEvent = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      receivedAuthEvent = true;
      // Never await Supabase operations while its auth callback holds the lock.
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!disposed) void loadSessionProfile(nextSession, event);
      }, 0);
      timers.add(timer);
    });
    const generation = loadGeneration.current;
    void boundedRequest(supabase.auth.getSession(), 10000).then(({ data, error }) => {
      if (disposed || receivedAuthEvent || generation !== loadGeneration.current) return;
      if (error) throw error;
      return loadSessionProfile(data.session);
    }).catch(error => {
      if (disposed || receivedAuthEvent || generation !== loadGeneration.current) return;
      console.error("Session startup failed:", error);
      setLoadingError("登录状态加载失败，请重试");
      setLoading(false);
    });
    return () => {
      disposed = true;
      loadGeneration.current++;
      timers.forEach(clearTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    loadGeneration.current++;
    activeUser.current = null;
    setLoadingError(null);
    setLoading(false);
    setUser(null);
    setSession(null);
    setProfile(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, loadingError, retryLoading, gradeAutoDetected, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
