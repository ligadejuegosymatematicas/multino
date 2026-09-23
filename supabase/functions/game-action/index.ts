import { createClient } from "npm:@supabase/supabase-js@2";
import {
  createPrivateOnlineState,
  createPublicOnlineState,
} from "../../../src/js/online/AuthoritativeRoomService.js";
import { RULESET_VERSION } from "../../../src/js/config/AppConfig.js";
import {
  createMatch,
  createSeat,
  participantsFromSeats,
} from "../../../src/js/game/index.js";
import {
  applyAuthenticatedIntent,
  drainServerCpuTurns,
  reconstructAuthoritativeFrames,
} from "../_shared/authoritative-action.js";
import { getSupabaseServerEnvironment } from "../_shared/supabase-env.ts";

const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "content-type": "application/json",
};

function response(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers });
}

function isStaleDatabaseError(error: { code?: string; message?: string } | null) {
  return error?.code === "40001" || error?.message?.includes("STALE_VERSION");
}

function serializeMoves(moves, seats) {
  const seatIndexById = new Map(
    seats.map((seat) => [`seat-${seat.seat_index + 1}`, seat.seat_index]),
  );
  return moves.map((move) => ({
    moveNumber: move.sequence,
    seatIndex: seatIndexById.get(move.playerId),
    actionType: move.type,
    publicPayload: move.type === "PLAY_DOMINO"
      ? { ...move.payload, result: move.result }
      : {},
    scoreDelta: move.result?.scoreAwarded ?? 0,
  }));
}

function projectMatch(state, seatId, version) {
  return {
    version,
    publicMatch: createPublicOnlineState(state),
    privateMatch: createPrivateOnlineState(state, seatId),
  };
}

function presentationEnvelope(state, seatId, version, afterSequence) {
  if (!Number.isSafeInteger(afterSequence)) return {};
  const replay = reconstructAuthoritativeFrames(state, afterSequence);
  return presentationEnvelopeFromStates(
    replay.baseState,
    replay.states,
    seatId,
    version,
  );
}

function presentationEnvelopeFromStates(baseState, states, seatId, version) {
  return {
    presentationBase: projectMatch(baseState, seatId, version),
    presentationFrames: states.map((frameState) => ({
      sequence: frameState.history.at(-1)?.sequence ?? 0,
      actorSeatId: frameState.history.at(-1)?.playerId ?? null,
      match: projectMatch(frameState, seatId, version),
    })),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const { url, publishableKey, secretKey } = getSupabaseServerEnvironment();
    if (!url || !publishableKey || !secretKey) {
      return response(503, { code: "SERVER_NOT_CONFIGURED" });
    }
    const authorization = request.headers.get("authorization") ?? "";
    const authClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser();
    if (authError || !authData.user) return response(401, { code: "AUTH_REQUIRED" });

    const admin = createClient(url, secretKey, { auth: { persistSession: false } });
    const { roomCode, expectedVersion, intent } = await request.json();
    const { data: room } = await admin.from("rooms")
      .select("id,version,status,host_user_id")
      .eq("code", String(roomCode).toUpperCase())
      .single();
    if (!room) return response(404, { code: "ROOM_NOT_FOUND" });
    const { data: seats } = await admin.from("room_seats")
      .select("id,seat_index,team_id,user_id,control_type,nick,connection_state")
      .eq("room_id", room.id)
      .order("seat_index");
    const callerSeat = seats?.find((seat) => seat.user_id === authData.user.id);
    if (!callerSeat) return response(403, { code: "NOT_ROOM_MEMBER" });

    if (intent?.type === "START_MATCH") {
      if (room.host_user_id !== authData.user.id) {
        return response(403, { code: "HOST_REQUIRED" });
      }
      if (room.version !== expectedVersion) {
        return response(409, { code: "STALE_VERSION", currentVersion: room.version });
      }
      if (room.status !== "LOBBY") return response(409, { code: "ROOM_ALREADY_STARTED" });
      const unresolved = (seats ?? []).filter((seat) =>
        seat.control_type === "HUMAN" &&
        (!seat.user_id || seat.connection_state !== "CONNECTED")
      );
      if (seats?.length !== 4 || unresolved.length > 0) {
        return response(409, { code: "UNRESOLVED_SEATS" });
      }
      const engineSeats = seats.map((seat) => createSeat({
        seatIndex: seat.seat_index,
        controlType: seat.control_type,
        nick: seat.nick,
        connectionState: seat.connection_state,
      }));
      let state = createMatch({
        ...participantsFromSeats(engineSeats),
        matchId: crypto.randomUUID(),
        mode: intent.mode,
      });
      const presentationBaseState = state;
      const cpuSeatIds = new Set(
        seats.filter((seat) => seat.control_type === "CPU")
          .map((seat) => `seat-${seat.seat_index + 1}`),
      );
      const cpuResult = drainServerCpuTurns(state, cpuSeatIds);
      state = cpuResult.state;
      const { data: started, error: startError } = await admin.rpc(
        "start_authoritative_match",
        {
          p_room_id: room.id,
          p_expected_room_version: expectedVersion,
          p_ruleset_version: RULESET_VERSION,
          p_private_state: state,
          p_public_state: createPublicOnlineState(state),
          p_match_players: seats.map((seat) => ({
            seatId: seat.id,
            seatIndex: seat.seat_index,
            teamId: seat.team_id,
            userId: seat.user_id,
            controlType: seat.control_type,
            nick: seat.nick,
          })),
          p_moves: serializeMoves(cpuResult.moves, seats),
        },
      );
      if (startError) {
        const stale = isStaleDatabaseError(startError);
        return response(stale ? 409 : 500, { code: stale ? "STALE_VERSION" : "START_FAILED" });
      }
      const seatId = `seat-${callerSeat.seat_index + 1}`;
      return response(200, {
        matchId: started?.[0]?.match_id,
        ...projectMatch(state, seatId, started?.[0]?.version),
        ...presentationEnvelopeFromStates(
          presentationBaseState,
          cpuResult.states,
          seatId,
          started?.[0]?.version,
        ),
      });
    }

    let matchQuery = admin.from("matches")
      .select("id,version")
      .eq("room_id", room.id);
    matchQuery = intent?.type === "SYNC_MATCH"
      ? matchQuery
        .in("status", ["PLAYING", "FINISHED"])
        .order("started_at", { ascending: false })
        .limit(1)
      : matchQuery.eq("status", "PLAYING");
    const { data: match } = await matchQuery.maybeSingle();
    if (!match) return response(409, { code: "MATCH_NOT_PLAYING" });
    const { data: privateState } = await admin.from("match_state_private")
      .select("state,version")
      .eq("match_id", match.id)
      .single();
    const seatId = `seat-${callerSeat.seat_index + 1}`;
    if (intent?.type === "SYNC_MATCH") {
      return response(200, {
        matchId: match.id,
        ...projectMatch(privateState.state, seatId, privateState.version),
        ...presentationEnvelope(
          privateState.state,
          seatId,
          privateState.version,
          intent.afterSequence,
        ),
      });
    }
    if (match.version !== expectedVersion || privateState.version !== expectedVersion) {
      return response(409, {
        code: "STALE_VERSION",
        currentVersion: Math.max(match.version, privateState.version),
      });
    }
    let nextState = applyAuthenticatedIntent(privateState.state, seatId, intent);
    const humanTransitionState = nextState;
    const { data: claimed, error: claimError } = await admin.rpc(
      "claim_match_transition",
      {
        p_match_id: match.id,
        p_expected_version: expectedVersion,
      },
    );
    if (claimError) return response(500, { code: "CLAIM_FAILED" });
    if (!claimed) {
      return response(409, { code: "STALE_VERSION", currentVersion: privateState.version });
    }
    const newMoves = [structuredClone(nextState.history.at(-1))];
    const cpuSeatIds = new Set(
      (seats ?? [])
        .filter((seat) => seat.control_type === "CPU")
        .map((seat) => `seat-${seat.seat_index + 1}`),
    );
    const cpuResult = drainServerCpuTurns(nextState, cpuSeatIds);
    nextState = cpuResult.state;
    newMoves.push(...cpuResult.moves);
    const persistedMoves = serializeMoves(newMoves, seats ?? []);
    const terminal = nextState.phase === "finished" ? nextState.roundResult : null;
    const { data: nextVersion, error: commitError } = await admin.rpc(
      "commit_game_transition",
      {
        p_match_id: match.id,
        p_expected_version: expectedVersion,
        p_next_state: nextState,
        p_public_state: createPublicOnlineState(nextState),
        p_moves: persistedMoves,
        p_finished: nextState.phase === "finished",
        p_winner_team_id: terminal?.winnerTeamId ?? null,
        p_termination_reason: terminal?.reason ?? null,
      },
    );
    if (commitError) {
      const stale = isStaleDatabaseError(commitError);
      return response(stale ? 409 : 500, { code: stale ? "STALE_VERSION" : "COMMIT_FAILED" });
    }
    return response(200, {
      ...projectMatch(nextState, seatId, nextVersion),
      ...presentationEnvelopeFromStates(
        privateState.state,
        [humanTransitionState, ...cpuResult.states],
        seatId,
        nextVersion,
      ),
    });
  } catch (error) {
    return response(400, { code: error?.code ?? "INVALID_REQUEST", message: error?.message });
  }
});
