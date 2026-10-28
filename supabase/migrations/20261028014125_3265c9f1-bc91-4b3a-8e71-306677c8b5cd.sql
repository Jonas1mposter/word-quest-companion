-- 修正观赛接口：使用 display_name/avatar_url 快照与 series_id/game_no/side/slot 键，与 tb_state 一致

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
  ) order by s.created_at desc) from tb_series s where s.status = 'active'), '[]'::jsonb);
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
    select idx, prompt, options into q from tb_questions
     where series_id = p_series and game_no = s.current_game and side = p.side and slot = p.slot and idx = pg.answered;
  end if;

  return jsonb_build_object(
    'ok', true, 'kind', s.kind, 'status', s.status,
    'nameA', s.name_a, 'nameB', s.name_b, 'winsA', s.wins_a, 'winsB', s.wins_b,
    'currentGame', s.current_game, 'winnerSide', s.winner_side, 'serverNow', now(),
    'players', v_players, 'games', v_games,
    'gameStatus', g.status, 'endsAt', g.ends_at,
    'watch', jsonb_build_object('side', p.side, 'slot', p.slot, 'name', p.display_name,
      'answered', coalesce(pg.answered, 0), 'correct', coalesce(pg.correct, 0),
      'question', case when q.idx is null then null else jsonb_build_object(
        'index', q.idx, 'total', 50, 'prompt', q.prompt, 'options', q.options) end)
  );
end $$;