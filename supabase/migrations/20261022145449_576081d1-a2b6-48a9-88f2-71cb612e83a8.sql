create or replace function public.report_dac_evidence(p_kind text, p_meta jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare pid uuid; k text := left(coalesce(p_kind,''),40);
begin
  if k not in ('extension_injection','native_tamper','synthetic_input','question_copy','multi_tab','devtools_open') then return; end if;
  select id into pid from profiles where user_id = auth.uid();
  if pid is null then return; end if;
  if exists (select 1 from dac_flags where profile_id=pid and reason=k and created_at > now()-interval '1 minute') then return; end if;
  perform dac_flag(pid, 'client_' || k, k, case when k in ('synthetic_input','multi_tab') then 'high' when k='devtools_open' then 'low' else 'medium' end,
    jsonb_build_object('detail', left(coalesce(p_meta,'{}'::jsonb)::text, 500)));
end $$;
revoke execute on function public.report_dac_evidence(text,jsonb) from anon, public;
grant execute on function public.report_dac_evidence(text,jsonb) to authenticated;