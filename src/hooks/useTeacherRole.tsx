import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useTeacherRole() {
  const { user } = useAuth();
  const [isTeacher, setIsTeacher] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      if (!user) {
        setIsTeacher(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .rpc('has_role', { _user_id: user.id, _role: 'teacher' });

      if (!error) {
        setIsTeacher(!!data);
      }
      setLoading(false);
    };

    checkRole();
  }, [user]);

  return { isTeacher, loading };
}
