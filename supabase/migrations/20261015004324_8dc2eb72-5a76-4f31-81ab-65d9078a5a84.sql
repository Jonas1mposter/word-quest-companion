create or replace function public.report_tab_switch(p_count integer, p_mode text)
returns void language plpgsql security definer set search_path=public as $$
declare pid uuid;
begin
  select id into pid from profiles where user_id = auth.uid();
  if pid is null then return; end if;
  perform dac_flag(pid, 'tab_switch', '对局中切屏', case when p_count>=3 then 'high' else 'medium' end,
    jsonb_build_object('count', least(greatest(p_count,1),100), 'mode', left(coalesce(p_mode,''),40)));
end $$;
revoke execute on function public.report_tab_switch(integer,text) from anon, public;
grant execute on function public.report_tab_switch(integer,text) to authenticated;