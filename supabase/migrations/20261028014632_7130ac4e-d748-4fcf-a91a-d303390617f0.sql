-- 2v2 战队赛：房间制开赛 + 混合题型 + 局间半场

alter table public.tb_series drop constraint tb_series_status_check;
alter table public.tb_series add constraint tb_series_status_check check (status in ('lobby','active','halftime','finished','cancelled'));
alter table public.tb_series add column if not exists break_ends_at timestamptz;
alter table public.tb_questions add column if not exists qtype text not null default 'choice';

-- 创建系列：进 lobby，不再自动开第一局
create or replace function public.tb_create_series(p_kind text, p_name_a text, p_name_b text, p_a uuid[], p_b uuid[], p_grade int default null, p_team_a uuid default null, p_team_b uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_admin uuid := tb_me(); v_id uuid; v_grade int; i int; v_pid uuid; v_name text; v_av text;
begin
  if v_admin is null or not has_role(auth.uid(), 'admin') then
    return jsonb_build_object('ok',false,'error','只有管理员可以创建比赛');
  end if;
  if p_kind not in ('team','casual') then return jsonb_build_object('ok',false,'error','类型错误'); end if;
  if coalesce(array_length(p_a,1),0) <> 2 or coalesce(array_length(p_b,1),0) <> 2 then
    return jsonb_build_object('ok',false,'error','每边需要 2 名选手');
  end if;
  if (select count(distinct x) from unnest(p_a || p_b) x) <> 4 then
    return jsonb_build_object('ok',false,'error','四名选手必须互不相同');
  end if;
  if p_kind = 'team' then
    if p_team_a is null or p_team_b is null or p_team_a = p_team_b then
      return jsonb_build_object('ok',false,'error','战队模式需要选择两支不同的战队');
    end if;
    if (select count(*) from team_members where team_id=p_team_a and profile_id = any(p_a)) <> 2
       or (select count(*) from team_members where team_id=p_team_b and profile_id = any(p_b)) <> 2 then
      return jsonb_build_object('ok',false,'error','选手必须是对应战队的成员');
    end if;
    select name into p_name_a from teams where id=p_team_a;
    select name into p_name_b from teams where id=p_team_b;
  end if;
  if coalesce(trim(p_name_a),'') = '' or coalesce(trim(p_name_b),'') = '' then
    return jsonb_build_object('ok',false,'error','需要双方队名');
  end if;
  if exists (select 1 from tb_series s join tb_players pl on pl.series_id=s.id
             where s.status in ('lobby','active','halftime') and pl.profile_id = any(p_a || p_b)) then
    return jsonb_build_object('ok',false,'error','有选手还在进行中的比赛里');
  end if;
  v_grade := coalesce(p_grade, (select greatest(max(coalesce(grade,7)),7) from profiles where id = any(p_a || p_b)), 7);
  insert into tb_series(kind, status, team_a, team_b, name_a, name_b, grade_key, created_by)
  values (p_kind, 'lobby', p_team_a, p_team_b, trim(p_name_a), trim(p_name_b), v_grade, v_admin) returning id into v_id;
  for i in 0..1 loop
    v_pid := p_a[i+1];
    select username, avatar_url into v_name, v_av from profiles where id=v_pid;
    insert into tb_players(series_id, side, slot, profile_id, display_name, avatar_url)
    values (v_id, 0, i, v_pid, coalesce(v_name,'玩家'), v_av);
    v_pid := p_b[i+1];
    select username, avatar_url into v_name, v_av from profiles where id=v_pid;
    insert into tb_players(series_id, side, slot, profile_id, display_name, avatar_url)
    values (v_id, 1, i, v_pid, coalesce(v_name,'玩家'), v_av);
  end loop;
  return jsonb_build_object('ok',true,'seriesId',v_id);
end $$;

-- 管理员统一开赛
create or replace function public.tb_start_series(p_series uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if tb_me() is null or not has_role(auth.uid(), 'admin') then
    return jsonb_build_object('ok',false,'error','只有管理员可以开赛');
  end if;
  select * into s from tb_series where id=p_series for update;
  if s is null then return jsonb_build_object('ok',false,'error','比赛不存在'); end if;
  if s.status <> 'lobby' then return jsonb_build_object('ok',false,'error','比赛已开始或已结束'); end if;
  update tb_series set status='active', updated_at=now() where id=p_series;
  perform tb_start_game(p_series, 1, s.grade_key);
  return jsonb_build_object('ok',true);
end $$;

-- 出题：约 30% 填空（prompt=中文释义，answer=英文单词），其余四选一
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
      select array_agg(m) into v_opts from (select distinct meaning m from hs_words where grade between 9 and 12 and meaning <> v_meaning and coalesce(meaning,'')<>'' order by random() limit 3) s;
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
      select array_agg(m) into v_opts from (select distinct meaning m from words where grade = p_grade and meaning <> v_meaning and coalesce(meaning,'')<>'' order by random() limit 3) s;
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

-- 结算：局完进入 3 分钟半场，休息结束再开下一局；系列赛结束直接 finished
create or replace function public.tb_tick(p_series uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s record; g record; v_done boolean; v_sa int; v_sb int; v_ta bigint; v_tb bigint; v_win smallint;
begin
  select * into s from tb_series where id=p_series for update;
  if s is null then return; end if;

  -- 半场结束 -> 开下一局
  if s.status = 'halftime' then
    if s.break_ends_at is not null and now() >= s.break_ends_at then
      update tb_series set status='active', current_game=current_game+1, break_ends_at=null, updated_at=now() where id=p_series;
      perform tb_start_game(p_series, s.current_game + 1, s.grade_key);
    end if;
    return;
  end if;

  if s.status <> 'active' then return; end if;
  select * into g from tb_games where series_id=p_series and game_no=s.current_game for update;
  if g is null or g.status <> 'active' then return; end if;
  select bool_and(answered >= 50) into v_done from tb_player_games where series_id=p_series and game_no=g.game_no;
  if not (coalesce(v_done,false) or now() >= g.ends_at) then return; end if;
  select coalesce(sum(correct) filter (where side=0),0), coalesce(sum(correct) filter (where side=1),0),
         coalesce(sum(total_ms) filter (where side=0),0), coalesce(sum(total_ms) filter (where side=1),0)
    into v_sa, v_sb, v_ta, v_tb from tb_player_games where series_id=p_series and game_no=g.game_no;
  v_win := case when v_sa > v_sb then 0 when v_sb > v_sa then 1
                when v_ta < v_tb then 0 when v_tb < v_ta then 1 end;
  update tb_games set status='finished', score_a=v_sa, score_b=v_sb, time_a=v_ta, time_b=v_tb, winner_side=v_win,
    ends_at=least(ends_at, now()) where series_id=p_series and game_no=g.game_no;
  update tb_series set wins_a = wins_a + case when v_win=0 then 1 else 0 end,
    wins_b = wins_b + case when v_win=1 then 1 else 0 end, updated_at=now() where id=p_series;
  select * into s from tb_series where id=p_series;
  if s.wins_a >= 2 or s.wins_b >= 2 or s.current_game >= 3 then
    update tb_series set status='finished', updated_at=now(),
      winner_side = case when wins_a > wins_b then 0 when wins_b > wins_a then 1 end where id=p_series;
  else
    update tb_series set status='halftime', break_ends_at = now() + interval '3 minutes', updated_at=now() where id=p_series;
  end if;
end $$;

-- 管理员在半场提前开下一局
create or replace function public.tb_resume(p_series uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if tb_me() is null or not has_role(auth.uid(), 'admin') then
    return jsonb_build_object('ok',false,'error','只有管理员可以操作');
  end if;
  select * into s from tb_series where id=p_series for update;
  if s is null then return jsonb_build_object('ok',false,'error','比赛不存在'); end if;
  if s.status <> 'halftime' then return jsonb_build_object('ok',false,'error','现在不在中场休息'); end if;
  update tb_series set break_ends_at = now() where id=p_series;
  perform tb_tick(p_series);
  return jsonb_build_object('ok',true);
end $$;

-- 选手状态：带题型、lobby/halftime 状态与半场倒计时
create or replace function public.tb_state(p_series uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pid uuid := tb_me(); me record; s record; g record; q record; pg record; v_players jsonb; v_games jsonb;
begin
  if v_pid is null then return jsonb_build_object('ok',false,'error','请先登录'); end if;
  select * into me from tb_players where series_id=p_series and profile_id=v_pid;
  if me is null then return jsonb_build_object('ok',false,'error','你不在这场比赛里'); end if;
  perform tb_tick(p_series);
  select * into s from tb_series where id=p_series;
  select * into g from tb_games where series_id=p_series and game_no=s.current_game;
  select * into pg from tb_player_games where series_id=p_series and game_no=s.current_game and side=me.side and slot=me.slot;
  select jsonb_agg(jsonb_build_object('side',p.side,'slot',p.slot,'name',p.display_name,'avatar',p.avatar_url,
    'answered',coalesce(pg2.answered,0),'correct',coalesce(pg2.correct,0)) order by p.side, p.slot)
    into v_players from tb_players p
    left join tb_player_games pg2 on pg2.series_id=p.series_id and pg2.game_no=s.current_game and pg2.side=p.side and pg2.slot=p.slot
    where p.series_id=p_series;
  select jsonb_agg(jsonb_build_object('gameNo',game_no,'status',status,'scoreA',score_a,'scoreB',score_b,
    'timeA',time_a,'timeB',time_b,'winnerSide',winner_side) order by game_no)
    into v_games from tb_games where series_id=p_series;
  q := null;
  if s.status='active' and g.status='active' and pg.answered < 50 then
    select idx, prompt, options, qtype into q from tb_questions
     where series_id=p_series and game_no=s.current_game and side=me.side and slot=me.slot and idx=pg.answered;
  end if;
  return jsonb_build_object('ok',true,'kind',s.kind,'status',s.status,'nameA',s.name_a,'nameB',s.name_b,
    'winsA',s.wins_a,'winsB',s.wins_b,'currentGame',s.current_game,'winnerSide',s.winner_side,
    'breakEndsAt',s.break_ends_at,
    'mySide',me.side,'mySlot',me.slot,'players',v_players,'games',v_games,
    'gameStatus',coalesce(g.status,'pending'),'endsAt',g.ends_at,'serverNow',now(),
    'myAnswered',coalesce(pg.answered,0),'myCorrect',coalesce(pg.correct,0),
    'question', case when q.idx is null then null
      else jsonb_build_object('index',q.idx,'total',50,'type',q.qtype,'prompt',q.prompt,
        'options', case when q.qtype='choice' then q.options else '[]'::jsonb end) end);
end $$;

-- 答题：填空题大小写不敏感、去首尾空格；重复提交返回原结果
create or replace function public.tb_answer(p_series uuid, p_index int, p_answer text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pid uuid := tb_me(); me record; s record; g record; q record; pg record; v_ok boolean; v_ms bigint;
begin
  if v_pid is null then return jsonb_build_object('ok',false,'error','请先登录'); end if;
  select * into s from tb_series where id=p_series for update;
  select * into me from tb_players where series_id=p_series and profile_id=v_pid;
  if me is null then return jsonb_build_object('ok',false,'error','你不在这场比赛里'); end if;
  if s.status <> 'active' then return jsonb_build_object('ok',false,'error','比赛未在进行中'); end if;
  select * into g from tb_games where series_id=p_series and game_no=s.current_game;
  if g.status <> 'active' or now() >= g.ends_at then perform tb_tick(p_series); return jsonb_build_object('ok',false,'error','本局已结束'); end if;
  select * into pg from tb_player_games where series_id=p_series and game_no=g.game_no and side=me.side and slot=me.slot for update;
  select * into q from tb_questions where series_id=p_series and game_no=g.game_no and side=me.side and slot=me.slot and idx=p_index;
  if q is null then return jsonb_build_object('ok',false,'error','题目不存在'); end if;
  if p_index < pg.answered then return jsonb_build_object('ok',true,'duplicate',true,'correct',null,'answer',q.answer); end if;
  if p_index <> pg.answered then return jsonb_build_object('ok',false,'error','题号不对'); end if;
  v_ok := lower(trim(p_answer)) = lower(trim(q.answer));
  v_ms := greatest(0, (extract(epoch from now() - q.issued_at) * 1000)::bigint);
  update tb_player_games set answered=answered+1, correct=correct + case when v_ok then 1 else 0 end,
    total_ms = total_ms + v_ms,
    finished_at = case when answered+1 >= 50 then now() end
   where series_id=p_series and game_no=g.game_no and side=me.side and slot=me.slot;
  perform tb_issue(p_series, g.game_no, me.side, me.slot, p_index+1, s.grade_key);
  perform tb_tick(p_series);
  return jsonb_build_object('ok',true,'correct',v_ok,'answer',q.answer);
end $$;

-- 观赛：同步新状态与题型，不含答案
create or replace function public.tb_open_series()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', s.id, 'kind', s.kind, 'nameA', s.name_a, 'nameB', s.name_b,
    'winsA', s.wins_a, 'winsB', s.wins_b, 'currentGame', s.current_game,
    'status', s.status, 'winnerSide', s.winner_side,
    'players', (select jsonb_agg(jsonb_build_object(
        'side', p.side, 'slot', p.slot, 'name', p.display_name, 'avatar', p.avatar_url,
        'answered', coalesce(pg.answered, 0), 'correct', coalesce(pg.correct, 0)) order by p.side, p.slot)
      from tb_players p
      left join tb_player_games pg on pg.series_id = p.series_id and pg.game_no = s.current_game
        and pg.side = p.side and pg.slot = p.slot
      where p.series_id = s.id)
  ) order by s.created_at desc) from tb_series s where s.status in ('lobby','active','halftime')), '[]'::jsonb);
end $$;

create or replace function public.tb_spectate(p_series uuid, p_slot integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s record; g record; p record; pg record; q record; v_players jsonb; v_games jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into s from tb_series where id = p_series;
  if s is null then return jsonb_build_object('ok', false, 'error', '系列赛不存在'); end if;

  perform tb_tick(p_series);
  select * into s from tb_series where id = p_series;

  select * into p from tb_players where series_id = p_series and slot = p_slot;
  if p is null then return jsonb_build_object('ok', false, 'error', '选手不存在'); end if;

  select * into g from tb_games where series_id = p_series and game_no = s.current_game;
  select * into pg from tb_player_games where series_id = p_series and game_no = s.current_game
    and side = p.side and slot = p.slot;

  select jsonb_agg(jsonb_build_object('side', tp.side, 'slot', tp.slot, 'name', tp.display_name, 'avatar', tp.avatar_url,
    'answered', coalesce(pg2.answered, 0), 'correct', coalesce(pg2.correct, 0)) order by tp.side, tp.slot)
    into v_players from tb_players tp
    left join tb_player_games pg2 on pg2.series_id = tp.series_id and pg2.game_no = s.current_game
      and pg2.side = tp.side and pg2.slot = tp.slot
    where tp.series_id = p_series;

  select jsonb_agg(jsonb_build_object('gameNo', game_no, 'status', status, 'scoreA', score_a, 'scoreB', score_b,
    'timeA', time_a, 'timeB', time_b, 'winnerSide', winner_side) order by game_no)
    into v_games from tb_games where series_id = p_series;

  q := null;
  if s.status = 'active' and g.status = 'active' and pg.answered < 50 then
    select idx, prompt, options, qtype into q from tb_questions
     where series_id = p_series and game_no = s.current_game and side = p.side and slot = p.slot and idx = pg.answered;
  end if;

  return jsonb_build_object(
    'ok', true, 'kind', s.kind, 'status', s.status,
    'nameA', s.name_a, 'nameB', s.name_b, 'winsA', s.wins_a, 'winsB', s.wins_b,
    'currentGame', s.current_game, 'winnerSide', s.winner_side, 'serverNow', now(),
    'breakEndsAt', s.break_ends_at,
    'players', v_players, 'games', v_games,
    'gameStatus', coalesce(g.status, 'pending'), 'endsAt', g.ends_at,
    'watch', jsonb_build_object('side', p.side, 'slot', p.slot, 'name', p.display_name,
      'answered', coalesce(pg.answered, 0), 'correct', coalesce(pg.correct, 0),
      'question', case when q.idx is null then null else jsonb_build_object(
        'index', q.idx, 'total', 50, 'type', q.qtype, 'prompt', q.prompt,
        'options', case when q.qtype='choice' then q.options else '[]'::jsonb end) end)
  );
end $$;

revoke all on function public.tb_start_series(uuid), public.tb_resume(uuid) from public, anon;
grant execute on function public.tb_start_series(uuid), public.tb_resume(uuid) to authenticated;