import assert from "node:assert/strict";

await import("../runtime-config.js");
const { getRuntimeConfig } = await import("../src/js/config/RuntimeConfig.js");
const { supabaseUrl, supabasePublicKey, onlineEnabled } = getRuntimeConfig();

assert.equal(onlineEnabled, true, "runtime-config debe contener solo la configuración pública real");

const authUrl = `${supabaseUrl}/auth/v1`;
const restUrl = `${supabaseUrl}/rest/v1`;
const functionsUrl = `${supabaseUrl}/functions/v1`;

async function jsonRequest(url, { token, body, method = "POST", headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      apikey: supabasePublicKey,
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function createAnonymousClient(label) {
  const result = await jsonRequest(`${authUrl}/signup`, { body: { data: { label } } });
  assert.equal(result.status, 200, `signInAnonymously ${label}: ${JSON.stringify(result.data)}`);
  assert.ok(result.data?.access_token && result.data?.refresh_token && result.data?.user?.id);
  return {
    label,
    userId: result.data.user.id,
    accessToken: result.data.access_token,
    refreshToken: result.data.refresh_token,
  };
}

async function refreshClient(client) {
  const result = await jsonRequest(`${authUrl}/token?grant_type=refresh_token`, {
    body: { refresh_token: client.refreshToken },
  });
  assert.equal(result.status, 200, `refresh ${client.label}`);
  assert.equal(result.data.user.id, client.userId, "refresh debe conservar la identidad anónima");
  return {
    ...client,
    accessToken: result.data.access_token,
    refreshToken: result.data.refresh_token,
  };
}

function invoke(functionName, client, body) {
  return jsonRequest(`${functionsUrl}/${functionName}`, {
    token: client.accessToken,
    body,
  });
}

function lobby(client, body) {
  return invoke("room-lobby", client, body);
}

function game(client, body) {
  return invoke("game-action", client, body);
}

function rest(client, path, options = {}) {
  return jsonRequest(`${restUrl}/${path}`, {
    token: client?.accessToken,
    method: options.method ?? "GET",
    body: options.body,
    headers: options.headers,
  });
}

function hasKeyDeep(value, forbiddenKey) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, forbiddenKey)) return true;
  return Object.values(value).some((nested) => hasKeyDeep(nested, forbiddenKey));
}

function containsExactString(value, target) {
  if (value === target) return true;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some((nested) => containsExactString(nested, target));
}

function exactStringPaths(value, target, path = "$") {
  if (value === target) return [path];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) =>
    exactStringPaths(nested, target, `${path}.${key}`)
  );
}

function actionIntent(action) {
  if (action.type === "PASS") return { type: "PASS" };
  return {
    type: "PLAY_TILE",
    dominoId: action.dominoId,
    target: structuredClone(action.target),
  };
}

function createRealtimeProbe(client, roomId) {
  const websocketUrl = supabaseUrl
    .replace(/^https:/, "wss:")
    .replace(/^http:/, "ws:") +
    `/realtime/v1/websocket?apikey=${encodeURIComponent(supabasePublicKey)}&vsn=1.0.0`;
  const socket = new WebSocket(websocketUrl);
  const topic = `realtime:multino-alpha-${roomId}`;
  const events = [];
  const diagnostics = [];
  const waiters = new Set();
  let joinReply = null;

  function notify() {
    for (const waiter of [...waiters]) waiter();
  }

  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data));
    diagnostics.push({
      event: message.event,
      status: message.payload?.status,
      extension: message.payload?.extension,
      message: message.payload?.message,
    });
    if (message.event === "phx_reply" && message.ref === "1") joinReply = message;
    if (message.event === "postgres_changes") events.push(message);
    notify();
  });

  const opened = new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  async function waitUntil(predicate, label, timeoutMs = 12000) {
    if (predicate()) return;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiters.delete(check);
        reject(new Error(`Realtime timeout: ${label}; ${JSON.stringify(diagnostics)}`));
      }, timeoutMs);
      function check() {
        if (!predicate()) return;
        clearTimeout(timeout);
        waiters.delete(check);
        resolve();
      }
      waiters.add(check);
    });
  }

  return {
    events,
    async join() {
      await opened;
      socket.send(JSON.stringify({
        topic,
        event: "phx_join",
        payload: {
          config: {
            broadcast: { ack: false, self: false },
            presence: { enabled: false },
            postgres_changes: [
              { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
              { event: "*", schema: "public", table: "matches", filter: `room_id=eq.${roomId}` },
            ],
            private: false,
          },
          access_token: client.accessToken,
        },
        ref: "1",
        join_ref: "1",
      }));
      await waitUntil(() => joinReply !== null, "join");
      assert.equal(joinReply.payload?.status, "ok", JSON.stringify(joinReply.payload));
      assert.equal(joinReply.payload?.response?.postgres_changes?.length, 2);
      await waitUntil(
        () => diagnostics.some(({ event, status }) => event === "system" && status === "ok"),
        "postgres_changes activo",
      );
    },
    waitForCount(count, label) {
      return waitUntil(() => events.length >= count, label);
    },
    close() {
      socket.close();
    },
  };
}

const host = await createAnonymousClient("host");
let guest = await createAnonymousClient("guest");
const outsider = await createAnonymousClient("outsider");

const created = await lobby(host, { type: "CREATE_ROOM", nick: "Henry Alpha" });
assert.equal(created.status, 200, JSON.stringify(created.data));
const roomCode = created.data.code;
const roomId = created.data.id;
assert.match(roomCode, /^[A-Z0-9]{5}$/);

const joined = await lobby(guest, { type: "JOIN_ROOM", roomCode, nick: "Invitado Alpha" });
assert.equal(joined.status, 200, JSON.stringify(joined.data));

const hostLobby = await lobby(host, { type: "GET_ROOM", roomCode });
const guestLobby = await lobby(guest, { type: "GET_ROOM", roomCode });
assert.equal(hostLobby.status, 200);
assert.equal(guestLobby.status, 200);
assert.deepEqual(
  hostLobby.data.room_seats.map(({ seat_index, team_id, control_type, user_id }) => ({
    seat_index,
    team_id,
    control_type,
    user_id,
  })),
  guestLobby.data.room_seats.map(({ seat_index, team_id, control_type, user_id }) => ({
    seat_index,
    team_id,
    control_type,
    user_id,
  })),
);

const outsiderRoom = await lobby(outsider, { type: "GET_ROOM", roomCode });
assert.equal(outsiderRoom.status, 403);

const realtime = createRealtimeProbe(host, roomId);
await realtime.join();

let configured = await lobby(host, {
  type: "SET_SEAT_CONTROL",
  roomCode,
  seatIndex: 2,
  controlType: "CPU",
});
assert.equal(configured.status, 200, JSON.stringify(configured.data));
await realtime.waitForCount(1, "actualización de lobby");

configured = await lobby(host, {
  type: "SET_SEAT_CONTROL",
  roomCode,
  seatIndex: 3,
  controlType: "CPU",
});
assert.equal(configured.status, 200, JSON.stringify(configured.data));

const started = await game(host, {
  roomCode,
  expectedVersion: configured.data.version,
  intent: { type: "START_MATCH", mode: "RAMIFICADO" },
});
assert.equal(started.status, 200, JSON.stringify(started.data));
assert.ok(started.data.privateMatch?.hand?.length >= 0);
await realtime.waitForCount(2, "inicio de partida");

let hostState = await game(host, {
  roomCode,
  expectedVersion: null,
  intent: { type: "SYNC_MATCH" },
});
let guestState = await game(guest, {
  roomCode,
  expectedVersion: null,
  intent: { type: "SYNC_MATCH" },
});
assert.equal(hostState.status, 200, JSON.stringify(hostState.data));
assert.equal(guestState.status, 200, JSON.stringify(guestState.data));
assert.equal(hasKeyDeep(hostState.data.publicMatch, "hands"), false);
assert.equal(hasKeyDeep(hostState.data.publicMatch, "dominoes"), false);
assert.equal(hasKeyDeep(hostState.data.privateMatch, "hands"), false);
assert.equal(hostState.data.privateMatch.hand.length, 7);
assert.equal(guestState.data.privateMatch.hand.length, 7);
assert.equal(
  hostState.data.privateMatch.hand.some((id) => guestState.data.privateMatch.hand.includes(id)),
  false,
);
for (const rivalTileId of guestState.data.privateMatch.hand) {
  const leakedPaths = exactStringPaths(hostState.data, rivalTileId);
  const nonPublicCataloguePaths = leakedPaths.filter((path) =>
    !/^\$\.privateMatch\.render\.ports\.portGraph\.macroNodes\.\d+\.ordinaryPorts\.\d+\.dominoId$/.test(path)
  );
  assert.deepEqual(
    nonPublicCataloguePaths,
    [],
    `una ficha rival no puede aparecer asociada a estado privado: ${nonPublicCataloguePaths.join(",")}`,
  );
  assert.equal(hostState.data.privateMatch.hand.includes(rivalTileId), false);
  assert.equal(Object.hasOwn(hostState.data.privateMatch.dominoes, rivalTileId), false);
  assert.equal(containsExactString(hostState.data.privateMatch.legalActions, rivalTileId), false);
}

const profiles = await rest(host, "profiles?select=id,nick");
assert.equal(profiles.status, 200);
assert.deepEqual(profiles.data.map(({ id }) => id), [host.userId]);
const anonymousProfiles = await rest(null, "profiles?select=id");
assert.ok([401, 403].includes(anonymousProfiles.status), "anon sin sesión no debe leer perfiles");
const hiddenPrivateState = await rest(host, "match_state_private?select=match_id,state");
assert.ok([401, 403].includes(hiddenPrivateState.status), "estado privado debe quedar fuera de Data API cliente");
const hiddenClaims = await rest(host, "match_action_claims?select=match_id,expected_version");
assert.ok([401, 403].includes(hiddenClaims.status), "reclamos internos deben quedar fuera de Data API cliente");
const outsiderRooms = await rest(outsider, "rooms?select=id,code");
assert.equal(outsiderRooms.status, 200);
assert.deepEqual(outsiderRooms.data, []);

guest = await refreshClient(guest);
const reconnectedLobby = await lobby(guest, { type: "GET_ROOM", roomCode });
assert.equal(reconnectedLobby.status, 200);
assert.equal(
  reconnectedLobby.data.room_seats.find((seat) => seat.user_id === guest.userId).seat_index,
  1,
);
guestState = await game(guest, {
  roomCode,
  expectedVersion: null,
  intent: { type: "SYNC_MATCH" },
});
assert.equal(guestState.status, 200);
assert.equal(guestState.data.privateMatch.seatId, "seat-2");

function clientForPlayer(playerId) {
  if (playerId === "seat-1") return host;
  if (playerId === "seat-2") return guest;
  throw new Error(`CPU pendiente sin drenar: ${playerId}`);
}

let current = hostState.data.publicMatch.currentPlayerId === "seat-1" ? hostState : guestState;
if (current.data.publicMatch.currentPlayerId !== current.data.privateMatch.seatId) {
  const actor = clientForPlayer(current.data.publicMatch.currentPlayerId);
  current = await game(actor, { roomCode, expectedVersion: null, intent: { type: "SYNC_MATCH" } });
}
const actor = clientForPlayer(current.data.publicMatch.currentPlayerId);
const nonActor = actor.userId === host.userId ? guest : host;
const legalAction = current.data.privateMatch.legalActions[0];
assert.ok(legalAction);
const outOfTurn = await game(nonActor, {
  roomCode,
  expectedVersion: current.data.version,
  intent: { type: "PASS" },
});
assert.equal(outOfTurn.status, 400);
assert.equal(outOfTurn.data.code, "OUT_OF_TURN");
const stale = await game(actor, {
  roomCode,
  expectedVersion: current.data.version - 1,
  intent: actionIntent(legalAction),
});
assert.equal(stale.status, 409);
assert.equal(stale.data.code, "STALE_VERSION");

const duplicatePayload = {
  roomCode,
  expectedVersion: current.data.version,
  intent: actionIntent(legalAction),
};
const duplicateResults = await Promise.all([
  game(actor, duplicatePayload),
  game(actor, duplicatePayload),
]);
assert.deepEqual(
  duplicateResults.map(({ status }) => status).sort(),
  [200, 409],
  JSON.stringify(duplicateResults.filter(({ status }) => status !== 200)),
);
let latest = duplicateResults.find(({ status }) => status === 200);
await realtime.waitForCount(3, "actualización de partida");

let cpuBatchObserved = false;
for (let turn = 0; turn < 80 && latest.data.publicMatch.phase === "playing"; turn += 1) {
  const nextClient = clientForPlayer(latest.data.publicMatch.currentPlayerId);
  const synced = await game(nextClient, {
    roomCode,
    expectedVersion: null,
    intent: { type: "SYNC_MATCH" },
  });
  assert.equal(synced.status, 200, JSON.stringify(synced.data));
  const nextAction = synced.data.privateMatch.legalActions[0];
  assert.ok(nextAction, "el humano actual debe recibir acciones privadas legales");
  const beforeMoves = synced.data.publicMatch.history.length;
  latest = await game(nextClient, {
    roomCode,
    expectedVersion: synced.data.version,
    intent: actionIntent(nextAction),
  });
  assert.equal(latest.status, 200, JSON.stringify(latest.data));
  if (latest.data.publicMatch.history.length > beforeMoves + 1) cpuBatchObserved = true;
}

assert.equal(latest.data.publicMatch.phase, "finished", "la ronda remota debe terminar");
assert.equal(cpuBatchObserved, true, "las CPU deben ejecutar turnos dentro de la función servidor");

const finalRoom = await rest(host, `rooms?select=id,status,version&id=eq.${roomId}`);
assert.equal(finalRoom.status, 200);
assert.equal(finalRoom.data[0].status, "FINISHED");
const finalMatches = await rest(host, `matches?select=id,status,version,winner_team_id,termination_reason&room_id=eq.${roomId}`);
assert.equal(finalMatches.status, 200);
assert.equal(finalMatches.data[0].status, "FINISHED");
const moveRows = await rest(host, `moves?select=move_number,seat_index,action_type,score_delta&match_id=eq.${finalMatches.data[0].id}`);
assert.equal(moveRows.status, 200);
assert.ok(moveRows.data.length > 0);
const seatRows = await rest(host, `room_seats?select=seat_index,team_id,control_type,user_id&room_id=eq.${roomId}`);
assert.equal(seatRows.status, 200);
assert.equal(seatRows.data.length, 4);
const playerRows = await rest(host, `match_players?select=seat_index,team_id,control_type,user_id&match_id=eq.${finalMatches.data[0].id}`);
assert.equal(playerRows.status, 200);
assert.equal(playerRows.data.length, 4);

const realtimeTables = new Set(
  realtime.events.map((event) => event.payload?.data?.table ?? event.payload?.table).filter(Boolean),
);
assert.equal(realtimeTables.has("rooms"), true);
assert.equal(realtimeTables.has("matches"), true);
realtime.close();

console.log(JSON.stringify({
  authAnonymous: true,
  roomCode,
  lobbyClients: 2,
  cpuSeats: 2,
  realtimeTables: [...realtimeTables].sort(),
  privateHandsIsolated: true,
  staleRejected: true,
  outOfTurnRejected: true,
  reconnectPreservedSeat: true,
  cpuServerSide: cpuBatchObserved,
  roundFinished: true,
  persistedMoves: moveRows.data.length,
}));
