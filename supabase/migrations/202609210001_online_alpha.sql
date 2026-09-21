create extension if not exists pgcrypto;

create type public.room_status as enum ('LOBBY', 'PLAYING', 'FINISHED');
create type public.seat_control_type as enum ('HUMAN', 'CPU');
create type public.seat_connection_state as enum ('EMPTY', 'CONNECTED', 'DISCONNECTED', 'SERVER');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nick text not null check (char_length(trim(nick)) between 1 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{5,8}$'),
  host_user_id uuid not null references auth.users(id),
  status public.room_status not null default 'LOBBY',
  version bigint not null default 0 check (version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_seats (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  seat_index smallint not null check (seat_index between 0 and 3),
  team_id text not null check (team_id in ('A', 'B')),
  control_type public.seat_control_type not null,
  user_id uuid references auth.users(id),
  nick text not null check (char_length(trim(nick)) between 1 and 24),
  connection_state public.seat_connection_state not null,
  cpu_difficulty text,
  unique (room_id, seat_index),
  unique (room_id, user_id),
  check (team_id = case when seat_index in (0, 2) then 'A' else 'B' end),
  check (
    (control_type = 'CPU' and user_id is null and connection_state = 'SERVER') or
    (control_type = 'HUMAN' and connection_state <> 'SERVER')
  )
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  ruleset_version text not null,
  status public.room_status not null default 'PLAYING',
  version bigint not null default 0 check (version >= 0),
  public_state jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  winner_team_id text check (winner_team_id in ('A', 'B') or winner_team_id is null),
  termination_reason text
);

create unique index one_active_match_per_room
  on public.matches(room_id)
  where status = 'PLAYING';

create table public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  seat_id uuid not null references public.room_seats(id),
  seat_index smallint not null check (seat_index between 0 and 3),
  team_id text not null check (team_id in ('A', 'B')),
  user_id uuid references auth.users(id),
  control_type public.seat_control_type not null,
  nick text not null,
  primary key (match_id, seat_index)
);

create table public.moves (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  move_number integer not null check (move_number > 0),
  seat_index smallint not null check (seat_index between 0 and 3),
  action_type text not null check (action_type in ('PLAY_DOMINO', 'PASS')),
  public_payload jsonb not null default '{}'::jsonb,
  score_delta integer not null default 0 check (score_delta >= 0),
  created_at timestamptz not null default now(),
  unique (match_id, move_number)
);

-- Tabla privada: contiene manos y snapshot autoritativo. No tiene políticas
-- de lectura para clientes; solo una función servidor con service_role accede.
create table public.match_state_private (
  match_id uuid primary key references public.matches(id) on delete cascade,
  version bigint not null check (version >= 0),
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_seats enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.moves enable row level security;
alter table public.match_state_private enable row level security;

create function public.is_room_member(candidate_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_seats
    where room_id = candidate_room_id and user_id = auth.uid()
  );
$$;

revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_member(uuid) to authenticated;

create policy "profiles_self_select" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "profiles_self_insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "room_members_read_room" on public.rooms
  for select to authenticated using (public.is_room_member(id));
create policy "room_members_read_seats" on public.room_seats
  for select to authenticated using (public.is_room_member(room_id));
create policy "room_members_read_matches" on public.matches
  for select to authenticated using (public.is_room_member(room_id));
create policy "room_members_read_match_players" on public.match_players
  for select to authenticated using (
    exists (
      select 1 from public.matches
      where matches.id = match_players.match_id
        and public.is_room_member(matches.room_id)
    )
  );
create policy "room_members_read_moves" on public.moves
  for select to authenticated using (
    exists (
      select 1 from public.matches
      where matches.id = moves.match_id
        and public.is_room_member(matches.room_id)
    )
  );

-- Compare-and-swap transaccional. La función NO decide legalidad: recibe el
-- resultado ya calculado por el único motor JS ejecutado en Edge Function.
create function public.commit_game_transition(
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

  return next_version;
end;
$$;

revoke all on function public.commit_game_transition(
  uuid, bigint, jsonb, jsonb, jsonb, boolean, text, text
) from public, anon, authenticated;

create function public.start_authoritative_match(
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
        version = version + 1,
        updated_at = now()
    where id = p_room_id;

  return query select created_match_id, 1::bigint;
end;
$$;

revoke all on function public.start_authoritative_match(
  uuid, bigint, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;

create function public.create_private_room(
  p_code text,
  p_host_user_id uuid,
  p_nick text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_room_id uuid;
begin
  insert into public.rooms(code, host_user_id)
    values (upper(p_code), p_host_user_id)
    returning id into created_room_id;
  insert into public.room_seats(
    room_id, seat_index, team_id, control_type, user_id, nick, connection_state
  ) values
    (created_room_id, 0, 'A', 'HUMAN', p_host_user_id, trim(p_nick), 'CONNECTED'),
    (created_room_id, 1, 'B', 'HUMAN', null, 'Asiento 2', 'EMPTY'),
    (created_room_id, 2, 'A', 'HUMAN', null, 'Asiento 3', 'EMPTY'),
    (created_room_id, 3, 'B', 'HUMAN', null, 'Asiento 4', 'EMPTY');
  return created_room_id;
end;
$$;

create function public.join_private_room(
  p_code text,
  p_user_id uuid,
  p_nick text
)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_seat public.room_seats%rowtype;
begin
  select room_seats.* into selected_seat
  from public.room_seats
  join public.rooms on rooms.id = room_seats.room_id
  where rooms.code = upper(p_code)
    and rooms.status = 'LOBBY'
    and room_seats.control_type = 'HUMAN'
    and room_seats.user_id is null
  order by room_seats.seat_index
  for update of room_seats skip locked
  limit 1;
  if selected_seat.id is null then
    raise exception 'ROOM_FULL' using errcode = 'P0001';
  end if;
  update public.room_seats
    set user_id = p_user_id, nick = trim(p_nick), connection_state = 'CONNECTED'
    where id = selected_seat.id;
  update public.rooms set version = version + 1, updated_at = now()
    where id = selected_seat.room_id;
  return selected_seat.seat_index;
end;
$$;

create function public.set_room_seat_control(
  p_room_id uuid,
  p_host_user_id uuid,
  p_seat_index smallint,
  p_control_type public.seat_control_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_seat public.room_seats%rowtype;
begin
  if not exists (
    select 1 from public.rooms
    where id = p_room_id and host_user_id = p_host_user_id and status = 'LOBBY'
  ) then
    raise exception 'HOST_REQUIRED' using errcode = 'P0001';
  end if;
  select * into target_seat from public.room_seats
    where room_id = p_room_id and seat_index = p_seat_index for update;
  if target_seat.user_id is not null and target_seat.user_id <> p_host_user_id then
    raise exception 'CONNECTED_HUMAN_PROTECTED' using errcode = 'P0001';
  end if;
  if p_seat_index = 0 and p_control_type = 'CPU' then
    raise exception 'HUMAN_REQUIRED' using errcode = 'P0001';
  end if;
  update public.room_seats set
    control_type = p_control_type,
    user_id = case when p_control_type = 'CPU' then null else user_id end,
    nick = case when p_control_type = 'CPU'
      then 'CPU ' || (p_seat_index + 1)::text
      else 'Asiento ' || (p_seat_index + 1)::text end,
    connection_state = case when p_control_type = 'CPU'
      then 'SERVER'::public.seat_connection_state
      else 'EMPTY'::public.seat_connection_state end,
    cpu_difficulty = case when p_control_type = 'CPU' then 'V1' else null end
  where id = target_seat.id;
  update public.rooms set version = version + 1, updated_at = now()
    where id = p_room_id;
end;
$$;

revoke all on function public.create_private_room(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.join_private_room(text, uuid, text)
  from public, anon, authenticated;
revoke all on function public.set_room_seat_control(
  uuid, uuid, smallint, public.seat_control_type
) from public, anon, authenticated;

-- match_state_private permanece default-deny: intencionalmente no hay policy.
