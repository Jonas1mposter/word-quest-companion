import { useAuth } from './useAuth';

export function useAdminRole() {
  const { user } = useAuth();
  // In localStorage mode, check a local admin list
  const adminEmails = JSON.parse(localStorage.getItem('wq_admin_emails') || '[]');
  const isAdmin = user ? adminEmails.includes(user.email) : false;
  
  return { isAdmin, loading: false };
}
