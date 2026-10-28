update public.tb_series set status = 'cancelled', updated_at = now()
where id = 'c09c0264-1d96-49ff-8996-2dfc2768fb68' and status in ('lobby','active','halftime');