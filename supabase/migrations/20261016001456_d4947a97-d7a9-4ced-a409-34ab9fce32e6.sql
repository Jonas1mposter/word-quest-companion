CREATE FUNCTION public.lottery_ticket_quote(p_discounted boolean,p_used integer,p_coins integer) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE price integer;
BEGIN
 IF p_discounted IS NULL OR p_used IS NULL OR p_used<0 OR p_coins IS NULL OR p_coins<0 THEN RAISE EXCEPTION 'invalid input'; END IF;
 IF p_discounted AND p_used>=10 THEN RETURN jsonb_build_object('error','discount_limit'); END IF;
 price := CASE WHEN p_discounted THEN 150 ELSE 200 END;
 IF p_coins<price THEN RETURN jsonb_build_object('error','insufficient_coins'); END IF;
 RETURN jsonb_build_object('price',price);
END $$;
GRANT EXECUTE ON FUNCTION public.champions_lottery_policy(timestamptz),public.champions_lottery_tier(numeric,integer,boolean,timestamptz),public.lottery_ticket_quote(boolean,integer,integer) TO PUBLIC;
CREATE OR REPLACE FUNCTION lottery_private.purchase_lottery_ticket(p_pool_id text,p_discounted boolean) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prof public.profiles%ROWTYPE; prog public.lottery_progress%ROWTYPE; price integer; ticket uuid; old_claims text; quote jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
 IF p_pool_id IS DISTINCT FROM 'champions-2024' OR p_discounted IS NULL THEN RAISE EXCEPTION 'invalid input'; END IF;
 SELECT * INTO prof FROM public.profiles WHERE user_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'profile not found'; END IF;
 IF prof.banned_until > now() THEN RAISE EXCEPTION 'account banned'; END IF;
 INSERT INTO public.lottery_progress(profile_id,pool_id) VALUES(prof.id,p_pool_id) ON CONFLICT DO NOTHING;
 SELECT * INTO prog FROM public.lottery_progress WHERE profile_id=prof.id AND pool_id=p_pool_id FOR UPDATE;
 quote := public.lottery_ticket_quote(p_discounted,prog.discounted_purchases,prof.coins);
 IF quote ? 'error' THEN RETURN quote; END IF;
 price := (quote->>'price')::integer;
 old_claims := current_setting('request.jwt.claims',true);
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 UPDATE public.profiles SET coins=coins-price WHERE id=prof.id;
 PERFORM set_config('request.jwt.claims',COALESCE(old_claims,''),true);
 INSERT INTO public.backpack_items(profile_id,item_type,amount,label,source,lottery_pool_id) VALUES(prof.id,'lottery_ticket',1,'冠军限定抽奖券','lottery_exchange',p_pool_id) RETURNING id INTO ticket;
 IF p_discounted THEN UPDATE public.lottery_progress SET discounted_purchases=discounted_purchases+1 WHERE profile_id=prof.id AND pool_id=p_pool_id; END IF;
 RETURN jsonb_build_object('ok',true,'ticket_id',ticket,'price',price);
END $$;