create or replace function public.admin_dac_risk(p_days integer default 30)
returns table(profile_id uuid, username text, score integer, flags integer, high_flags integer, server_flags integer, top_reason text, last_at timestamptz)
language plpgsql stable security definer set search_path=public as $$
begin
  if not has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  return query
  select f.profile_id, p.username,
    sum((case f.severity when 'high' then 5 when 'medium' then 2 else 1 end)
        * (case when f.source like 'client_%' or f.source='tab_switch' then 1 else 2 end))::int,
    count(*)::int, count(*) filter (where f.severity='high')::int,
    count(*) filter (where f.source not like 'client_%' and f.source<>'tab_switch')::int,
    mode() within group (order by f.reason), max(f.created_at)
  from dac_flags f join profiles p on p.id=f.profile_id
  where f.created_at > now() - make_interval(days => greatest(1,least(p_days,180)))
  group by f.profile_id, p.username
  order by 3 desc limit 50;
end $$;
revoke execute on function public.admin_dac_risk(integer) from anon, public;
grant execute on function public.admin_dac_risk(integer) to authenticated;

create or replace function public.admin_dac_timing_twins(p_days integer default 7)
returns table(player_a uuid, name_a text, player_b uuid, name_b text, shared_buckets integer, mean_ms integer)
language plpgsql stable security definer set search_path=public as $$
begin
  if not has_role(auth.uid(),'admin') then raise exception 'forbidden'; end if;
  return query
  with g as (
    select player_id, match_id,
      extract(epoch from answered_at - lag(answered_at) over (partition by player_id, match_id order by answered_at))*1000 as gap
    from match_answers where answered_at > now() - make_interval(days => greatest(1,least(p_days,30)))
  ), s as (
    select player_id, match_id, avg(gap) m, stddev_pop(gap) sd, count(*) n
    from g where gap between 200 and 60000 group by 1,2
  ), b as (
    select player_id, (round(m/150))::int bucket, round(m)::int m from s where n>=7 and m>0 and sd/m < 0.2
  ), pairs as (
    select x.player_id a, y.player_id b2, count(distinct x.bucket) sb, avg(x.m)::int mm
    from b x join b y on x.bucket=y.bucket and x.player_id < y.player_id group by 1,2
  )
  select pr.a, pa.username, pr.b2, pb.username, pr.sb::int, pr.mm
  from pairs pr join profiles pa on pa.id=pr.a join profiles pb on pb.id=pr.b2
  where pr.sb >= 2 order by pr.sb desc limit 30;
end $$;
revoke execute on function public.admin_dac_timing_twins(integer) from anon, public;
grant execute on function public.admin_dac_timing_twins(integer) to authenticated;