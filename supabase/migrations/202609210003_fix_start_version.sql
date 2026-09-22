-- Califica la columna porque `version` también es un parámetro de salida.
create or replace function public.start_authoritative_match(
  p_room_id uuid,
  p_expected_room_version bigint,
  p_ruleset_version text,
  p_private_state jsonb,
  p_public_state jsonb,
  p_match_players jsonb,
  p_moves jsonb
)
returns table(match_id uuid, version bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  locked_room public.rooms%rowtype;
  created_match_id uuid;
begin
  select * into locked_room
  from public.rooms
  where id = p_room_id
  for update;

  if locked_room.id is null or locked_room.version <> p_expected_room_version then
    raise exception 'STALE_VERSION' using errcode = '40001';
  end if;
  if locked_room.status <> 'LOBBY' then
    raise exception 'ROOM_ALREADY_STARTED' using errcode = 'P0001';
  end if;

  insert into public.matches (
    room_id, ruleset_version, status, version, public_state
  ) values (
    p_room_id,
    p_ruleset_version,
    case when p_private_state->>'phase' = 'finished'
      then 'FINISHED'::public.room_status else 'PLAYING'::public.room_status end,
    1,
    p_public_state
  ) returning id into created_match_id;

  insert into public.match_state_private(match_id, version, state)
    values (created_match_id, 1, p_private_state);

  insert into public.match_players (
    match_id, seat_id, seat_index, team_id, user_id, control_type, nick
  )
  select
    created_match_id,
    (item->>'seatId')::uuid,
    (item->>'seatIndex')::smallint,
    item->>'teamId',
    nullif(item->>'userId', '')::uuid,
    (item->>'controlType')::public.seat_control_type,
    item->>'nick'
  from jsonb_array_elements(p_match_players) as item;

  insert into public.moves (
    match_id, move_number, seat_index, action_type, public_payload, score_delta
  )
  select
    created_match_id,
    (item->>'moveNumber')::integer,
    (item->>'seatIndex')::smallint,
    item->>'actionType',
    coalesce(item->'publicPayload', '{}'::jsonb),
    coalesce((item->>'scoreDelta')::integer, 0)
  from jsonb_array_elements(p_moves) as item;

  update public.rooms
    set status = case when p_private_state->>'phase' = 'finished'
      then 'FINISHED'::public.room_status else 'PLAYING'::public.room_status end,
        version = rooms.version + 1,
        updated_at = now()
    where id = p_room_id;

  return query select created_match_id, 1::bigint;
end;
$$;

revoke all on function public.start_authoritative_match(
  uuid, bigint, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
grant execute on function public.start_authoritative_match(
  uuid, bigint, text, jsonb, jsonb, jsonb, jsonb
) to service_role;
