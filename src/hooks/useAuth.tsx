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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_PROFILE: Omit<Profile, 'id' | 'user_id' | 'username'> = {
  grade: 7,
  level: 1,
  xp: 0,
  xp_to_next_level: 100,
  coins: 100,
  energy: 10,
  max_energy: 10,
  streak: 0,
  rank_tier: "bronze",
  rank_stars: 0,
  rank_points: 0,
  wins: 0,
  losses: 0,
  avatar_url: null,
  class: null,
  elo_rating: 1000,
  elo_free: 1000,
  free_match_wins: 0,
  free_match_losses: 0,
  last_energy_restore: null,
  total_xp: 0,
  max_combo: 0,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAndRestoreEnergy = (profileData: Profile): Profile => {
    const today = new Date().toISOString().split('T')[0];
    const lastRestore = profileData.last_energy_restore;
    
    if (!lastRestore || lastRestore < today) {
      const updated = {
        ...profileData,
        energy: profileData.max_energy,
        last_energy_restore: today
      };
      // Save updated profile
      const profiles = JSON.parse(localStorage.getItem('wq_profiles') || '[]');
      const idx = profiles.findIndex((p: any) => p.id === profileData.id);
      if (idx >= 0) {
        profiles[idx] = { ...profiles[idx], energy: updated.energy, last_energy_restore: today };
        localStorage.setItem('wq_profiles', JSON.stringify(profiles));
      }
      return updated;
    }
    return profileData;
  };

  const fetchProfile = (userId: string, userEmail?: string): Profile | null => {
    const profiles: Profile[] = JSON.parse(localStorage.getItem('wq_profiles') || '[]');
    let profile = profiles.find(p => p.user_id === userId);
    
    if (!profile && userEmail) {
      const username = userEmail.split('@')[0];
      profile = {
        id: crypto.randomUUID(),
        user_id: userId,
        username,
        ...DEFAULT_PROFILE,
      };
      profiles.push(profile);
      localStorage.setItem('wq_profiles', JSON.stringify(profiles));
    }
    
    if (profile) {
      return checkAndRestoreEnergy(profile);
    }
    return null;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: string, session: any) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const p = fetchProfile(session.user.id, session.user.email);
          setProfile(p);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        const p = fetchProfile(session.user.id, session.user.email);
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
