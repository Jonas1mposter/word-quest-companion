create or replace function public.tb_my_series() returns uuid language sql stable security definer set search_path = public as $$
  select s.id from tb_series s join tb_players p on p.series_id=s.id
  where p.profile_id = tb_me() and s.status in ('lobby','active','halftime') order by s.created_at desc limit 1 $$;