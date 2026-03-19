import { useAuth } from './useAuth';

export function useTeacherRole() {
  const { user } = useAuth();
  const teacherEmails = JSON.parse(localStorage.getItem('wq_teacher_emails') || '[]');
  const isTeacher = user ? teacherEmails.includes(user.email) : false;
  
  return { isTeacher, loading: false };
}
