create or replace function public.leaderboard_excluded_ids()
returns setof uuid language sql stable security definer set search_path=public as $$
  select p.id from profiles p join user_roles r on r.user_id=p.user_id where r.role='admin'
$$;
grant execute on function public.leaderboard_excluded_ids() to anon, authenticated, service_role;