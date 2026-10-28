create or replace function public.tb_issue(p_series uuid, p_game int, p_side int, p_slot int, p_idx int, p_grade int)
returns void language plpgsql security definer set search_path = public as $$
declare v_word text; v_meaning text; v_opts text[]; v_fill boolean;
begin
  if p_idx >= 50 then return; end if;
  v_fill := random() < 0.3;
  if p_grade >= 9 then
    select word, meaning into v_word, v_meaning from hs_words
     where grade between 9 and 12 and coalesce(meaning,'') <> ''
       and word not in (select case when qtype='choice' then prompt else answer end from tb_questions
                        where series_id=p_series and game_no=p_game and side=p_side and slot=p_slot)
     order by random() limit 1;
    if not v_fill then
      select array_agg(m) into v_opts from (
        select m from (select distinct meaning m from hs_words
          where grade between 9 and 12 and meaning <> v_meaning and coalesce(meaning,'')<>'') d
        order by random() limit 3) s;
    end if;
  else
    select word, meaning into v_word, v_meaning from words
     where grade = p_grade and coalesce(meaning,'') <> ''
       and word not in (select case when qtype='choice' then prompt else answer end from tb_questions
                        where series_id=p_series and game_no=p_game and side=p_side and slot=p_slot)
     order by random() limit 1;
    if v_word is null then
      select word, meaning into v_word, v_meaning from words where coalesce(meaning,'')<>'' order by random() limit 1;
    end if;
    if not v_fill then
      select array_agg(m) into v_opts from (
        select m from (select distinct meaning m from words
          where grade = p_grade and meaning <> v_meaning and coalesce(meaning,'')<>'') d
        order by random() limit 3) s;
    end if;
  end if;
  if v_word is null then return; end if;
  if v_fill then
    insert into tb_questions(series_id, game_no, side, slot, idx, prompt, options, answer, qtype)
    values (p_series, p_game, p_side, p_slot, p_idx, v_meaning, '[]'::jsonb, v_word, 'fill') on conflict do nothing;
  else
    v_opts := coalesce(v_opts,'{}') || v_meaning;
    select array_agg(o order by random()) into v_opts from unnest(v_opts) o;
    insert into tb_questions(series_id, game_no, side, slot, idx, prompt, options, answer, qtype)
    values (p_series, p_game, p_side, p_slot, p_idx, v_word, to_jsonb(v_opts), v_meaning, 'choice') on conflict do nothing;
  end if;
end $$;