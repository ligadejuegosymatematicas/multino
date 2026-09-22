-- Las versiones de partida se sincronizan por estado lógico, no por animación.
do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end;
$$;

-- Al terminar una ronda, el cierre del match y de la sala es atómico.
create or replace function public.commit_game_transition(
  p_match_id uuid,
  p_expected_version bigint,
  p_next_state jsonb,
  p_public_state jsonb,
  p_moves jsonb,
  p_finished boolean,
  p_winner_team_id text default null,
  p_termination_reason text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_version bigint;
  next_version bigint;
begin
  if not pg_try_advisory_xact_lock(hashtextextended(p_match_id::text, 0)) then
    raise exception 'STALE_VERSION' using errcode = '40001';
  end if;

  select version into current_version
  from public.match_state_private
  where match_id = p_match_id
  for update;

  if current_version is null or current_version <> p_expected_version then
    raise exception 'STALE_VERSION' using errcode = '40001';
  end if;

  next_version := current_version + 1;
  update public.match_state_private
    set version = next_version, state = p_next_state, updated_at = now()
    where match_id = p_match_id;

  update public.matches
    set version = next_version,
        public_state = p_public_state,
        status = case when p_finished then 'FINISHED'::public.room_status else status end,
        finished_at = case when p_finished then now() else finished_at end,
        winner_team_id = p_winner_team_id,
        termination_reason = p_termination_reason
    where id = p_match_id;

  insert into public.moves (
    match_id, move_number, seat_index, action_type, public_payload, score_delta
  )
  select
    p_match_id,
    (item->>'moveNumber')::integer,
    (item->>'seatIndex')::smallint,
    item->>'actionType',
    coalesce(item->'publicPayload', '{}'::jsonb),
    coalesce((item->>'scoreDelta')::integer, 0)
  from jsonb_array_elements(p_moves) as item;

  if p_finished then
    update public.rooms
      set status = 'FINISHED'::public.room_status,
          version = version + 1,
          updated_at = now()
      where id = (select room_id from public.matches where id = p_match_id);
  end if;

  return next_version;
end;
$$;

revoke all on function public.commit_game_transition(
  uuid, bigint, jsonb, jsonb, jsonb, boolean, text, text
) from public, anon, authenticated;
grant execute on function public.commit_game_transition(
  uuid, bigint, jsonb, jsonb, jsonb, boolean, text, text
) to service_role;
