CREATE FUNCTION public.bot_timing_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer; mean_ms numeric; std_ms numeric;
BEGIN
 IF jsonb_array_length(NEW.answers)=jsonb_array_length(OLD.answers) THEN RETURN NEW; END IF;
 SELECT count(*),avg((v->>'elapsedMs')::numeric),stddev_pop((v->>'elapsedMs')::numeric) INTO n,mean_ms,std_ms FROM jsonb_array_elements(NEW.answers) v WHERE coalesce(v->>'answer','')<>'';
 IF n=6 AND mean_ms>0 AND std_ms/mean_ms<0.12 THEN
  PERFORM public.dac_flag(NEW.profile_id,'bot-battle','suspected_fixed_answer_timing','medium',jsonb_build_object('sessionId',NEW.id,'samples',n,'meanMs',round(mean_ms),'stdMs',round(std_ms),'reviewOnly',true));
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.bot_timing_review() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER bot_timing_review AFTER UPDATE ON public.bot_battle_sessions FOR EACH ROW EXECUTE FUNCTION public.bot_timing_review();