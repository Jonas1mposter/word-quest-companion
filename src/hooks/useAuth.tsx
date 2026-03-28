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

  const detectGradeFromAzureGroups = async (providerToken: string): Promise<number | null> => {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me/memberOf?$select=displayName', {
        headers: { 'Authorization': `Bearer ${providerToken}` }
      });
      if (!response.ok) {
        console.warn('Graph API groups fetch failed:', response.status);
        return null;
      }
      const data = await response.json();
      if (data.value) {
        for (const group of data.value) {
          const name = (group.displayName || '').toLowerCase();
          if (name.includes('grade_8')) return 8;
          if (name.includes('grade_7')) return 7;
        }
      }
    } catch (err) {
      console.error('Error fetching Azure AD groups:', err);
    }
    return null;
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
              // Try Azure AD group-based grade detection first (using provider_token)
              let detectedGrade: number | null = null;
              if (session.provider_token) {
                detectedGrade = await detectGradeFromAzureGroups(session.provider_token);
              }
              // Fallback to email-based detection
              if (!detectedGrade && session.user.email) {
                detectedGrade = detectGradeFromEmail(session.user.email);
              }
              if (detectedGrade && p.grade !== detectedGrade) {
                const { data: updated } = await supabase
                  .from("profiles")
                  .update({ grade: detectedGrade })
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
    <AuthContext.Provider value={{ user, session, profile, loading, signOut, refreshProfile }}>
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
