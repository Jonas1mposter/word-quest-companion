-- 观赛接口：列出进行中的系列赛 + 按选手视角只读观战（不含答案）

create or replace function public.tb_open_series()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', s.id, 'kind', s.kind, 'nameA', s.name_a, 'nameB', s.name_b,
    'winsA', s.wins_a, 'winsB', s.wins_b, 'currentGame', s.current_game,
    'status', s.status, 'winnerSide', s.winner_side,
    'players', (select jsonb_agg(jsonb_build_object(
        'side', p.side, 'slot', p.slot, 'name', pr.username, 'avatar', pr.avatar_url,
        'answered', p.answered, 'correct', p.correct) order by p.side, p.slot)
      from tb_players p join profiles pr on pr.id = p.profile_id where p.series_id = s.id)
  ) order by s.created_at desc) from tb_series s where s.status = 'active'), '[]'::jsonb);
end $$;

create or replace function public.tb_spectate(p_series uuid, p_slot integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s tb_series; g tb_games; p tb_players; pg tb_player_games; q tb_questions;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into s from tb_series where id = p_series;
  if not found then return jsonb_build_object('ok', false, 'error', '系列赛不存在'); end if;

  if s.status = 'active' then perform tb_tick(p_series); select * into s from tb_series where id = p_series; end if;

  select * into p from tb_players where series_id = p_series and slot = p_slot;
  if not found then return jsonb_build_object('ok', false, 'error', '选手不存在'); end if;

  select * into g from tb_games where series_id = p_series and game_no = s.current_game;
  select * into pg from tb_player_games where game_id = g.id and profile_id = p.profile_id;

  q := null;
  if g.status = 'active' and pg.answered < 50 then
    select * into q from tb_questions where player_game_id = pg.id and idx = pg.answered;
  end if;

  return jsonb_build_object(
    'ok', true, 'kind', s.kind, 'status', s.status,
    'nameA', s.name_a, 'nameB', s.name_b, 'winsA', s.wins_a, 'winsB', s.wins_b,
    'currentGame', s.current_game, 'winnerSide', s.winner_side,
    'serverNow', v_now,
    'players', (select jsonb_agg(jsonb_build_object(
        'side', tp.side, 'slot', tp.slot, 'name', pr.username, 'avatar', pr.avatar_url,
        'answered', tp.answered, 'correct', tp.correct) order by tp.side, tp.slot)
      from tb_players tp join profiles pr on pr.id = tp.profile_id where tp.series_id = p_series),
    'games', (select jsonb_agg(jsonb_build_object(
        'gameNo', tg.game_no, 'status', tg.status, 'scoreA', tg.score_a, 'scoreB', tg.score_b,
        'timeA', tg.time_a, 'timeB', tg.time_b, 'winnerSide', tg.winner_side) order by tg.game_no)
      from tb_games tg where tg.series_id = p_series),
    'gameStatus', g.status, 'endsAt', g.ends_at,
    'watch', jsonb_build_object('side', p.side, 'slot', p.slot, 'name', (select username from profiles where id = p.profile_id),
      'answered', pg.answered, 'correct', pg.correct,
      'question', case when q.id is null then null else jsonb_build_object(
        'index', q.idx, 'total', 50, 'prompt', q.prompt, 'options', q.options) end)
  );
end $$;

revoke all on function public.tb_open_series() from public, anon;
revoke all on function public.tb_spectate(uuid, integer) from public, anon;
grant execute on function public.tb_open_series() to authenticated;
grant execute on function public.tb_spectate(uuid, integer) to authenticated;