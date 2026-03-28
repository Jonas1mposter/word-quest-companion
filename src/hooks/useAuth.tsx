import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

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
      const meRes = await fetch('https://graph.microsoft.com/v1.0/me?$select=displayName', {
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        displayName = meData.displayName || null;
      }

      // Fetch group memberships for grade detection
      const groupsRes = await fetch('https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName', {
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
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
      const photoRes = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      if (!photoRes.ok) return null;

      const blob = await photoRes.blob();
      if (blob.size === 0) return null;

      // Upload to Supabase storage
      const fileName = `microsoft_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

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
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }

    if (data) {
      // Check daily energy restore
      const today = new Date().toISOString().split('T')[0];
      if (!data.last_energy_restore || data.last_energy_restore < today) {
        const { data: updated } = await supabase
          .from("profiles")
          .update({ energy: data.max_energy, last_energy_restore: today })
          .eq("id", data.id)
          .select()
          .single();
        return updated as Profile | null;
      }
    }

    return data as Profile | null;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: string, session: any) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase auth
          setTimeout(async () => {
            const p = await fetchProfile(session.user.id);
            if (p) {
              const updates: Record<string, any> = {};

              if (session.provider_token) {
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
                  if (p.grade !== detectedGrade) {
                    updates.grade = detectedGrade;
                  }
                } else {
                  // Fallback to email-based detection
                  const emailGrade = session.user.email ? detectGradeFromEmail(session.user.email) : null;
                  if (emailGrade) {
                    setGradeAutoDetected(true);
                    if (p.grade !== emailGrade) updates.grade = emailGrade;
                  } else {
                    setGradeAutoDetected(false);
                  }
                }
              } else {
                // No provider token, fallback to email
                const emailGrade = session.user.email ? detectGradeFromEmail(session.user.email) : null;
                if (emailGrade) {
                  setGradeAutoDetected(true);
                  if (p.grade !== emailGrade) updates.grade = emailGrade;
                } else {
                  setGradeAutoDetected(false);
                }
              }

              // Apply all updates in one query
              if (Object.keys(updates).length > 0) {
                const { data: updated } = await supabase
                  .from("profiles")
                  .update(updates)
                  .eq("id", p.id)
                  .select()
                  .single();
                if (updated) {
                  setProfile(updated as Profile);
                  setLoading(false);
                  return;
                }
              }
            }
            setProfile(p);
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }: any) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const p = await fetchProfile(session.user.id);
        setProfile(p);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, gradeAutoDetected, signOut, refreshProfile }}>
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
