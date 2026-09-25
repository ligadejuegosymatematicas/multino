import assert from "node:assert/strict";
import test from "node:test";

import {
  ONLINE_SCREENS,
  OnlineGameSessionController,
  createOnlineRoundPresentation,
} from "../../src/js/online/OnlineGameSessionController.js";
import { createBrowserSupabaseGateway, createBrowserGatewayProvider } from "../../src/js/online/SupabaseBrowserClient.js";
import { SupabaseGateway } from "../../src/js/online/SupabaseGateway.js";

function projectedView({ current = true } = {}) {
  return {
    hand: [{ dominoId: "d:4:5", a: 4, b: 5, legalTargetCount: current ? 1 : 0 }],
    legalPlays: current
      ? [{ dominoId: "d:4:5", legalTargetCount: 1, legalTargets: [{ kind: "START" }] }]
      : [],
    participants: {
      players: [
        { playerId: "seat-1", displayName: "Ada", isCurrentPlayer: current },
        { playerId: "seat-2", displayName: "Bruno", isCurrentPlayer: !current },
      ],
      teams: [],
    },
    scoringPresentation: { enabled: false },
  };
}

function matchResponse({
  currentPlayerId = "seat-1",
  privateSeatId = "seat-1",
  version = 1,
  target = { kind: "START" },
  sequence = 0,
  phase = "playing",
} = {}) {
  const graph = projectedView({ current: currentPlayerId === privateSeatId });
  if (graph.legalPlays[0]) graph.legalPlays[0].legalTargets = [target];
  return {
    version,
    publicMatch: {
      phase,
      currentPlayerId,
      remainingDominoCountByPlayer: { "seat-1": 1, "seat-2": 7 },
      history: Array.from({ length: sequence }, (_, index) => ({
        sequence: index + 1,
        playerId: index + 1 === sequence ? currentPlayerId : `seat-${index % 4 + 1}`,
        type: "PLAY_DOMINO",
        result: { scoreAwarded: 0 },
      })),
    },
    privateMatch: {
      seatId: privateSeatId,
      hand: ["d:4:5"],
      dominoes: { "d:4:5": { id: "d:4:5" } },
      legalActions: currentPlayerId === privateSeatId
        ? [{
            type: "PLAY_DOMINO",
            dominoId: "d:4:5",
            target: target.kind === "START"
              ? target
              : {
                  kind: "OPEN_END",
                  placementId: target.placementId,
                  portId: target.portId,
                },
          }]
        : [],
      render: { graph, ports: graph, traditional: graph },
    },
  };
}

function queuedMatch({
  sequences,
  version = 2,
  finalPhase = "playing",
  privateSeatId = "seat-1",
  actorSeatIds = null,
  currentPlayerIds = null,
} = {}) {
  const base = matchResponse({
    sequence: sequences[0] - 1,
    version,
    privateSeatId,
  });
  const frames = sequences.map((sequence, index) => {
    const actorSeatId = actorSeatIds?.[index] ?? `seat-${index + 2}`;
    return {
      sequence,
      actorSeatId,
      match: matchResponse({
        sequence,
        currentPlayerId: currentPlayerIds?.[index] ?? actorSeatId,
        privateSeatId,
        version,
        phase: index === sequences.length - 1 ? finalPhase : "playing",
      }),
    };
  });
  return {
    ...frames.at(-1).match,
    presentationBase: base,
    presentationFrames: frames,
  };
}

function room({ humanSeatIndex = 0 } = {}) {
  return {
    id: "room-1",
    code: "ABCDE",
    host_user_id: "user-1",
    status: "LOBBY",
    version: 0,
    room_seats: Array.from({ length: 4 }, (_, seat_index) => ({
      id: `db-seat-${seat_index}`,
      seat_index,
      team_id: seat_index % 2 === 0 ? "A" : "B",
      control_type: seat_index === humanSeatIndex ? "HUMAN" : "CPU",
      user_id: seat_index === humanSeatIndex ? "user-1" : null,
      nick: seat_index === humanSeatIndex ? "Ada" : `CPU ${seat_index + 1}`,
      connection_state: seat_index === humanSeatIndex ? "CONNECTED" : "SERVER",
    })),
  };
}

test("la sesión online crea lobby, inicia y envía solo intenciones", async () => {
  const calls = [];
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async (intent) => {
      calls.push(intent);
      return room();
    },
    sendIntent: async (payload) => {
      calls.push(payload);
      return matchResponse({ version: payload.intent.type === "START_MATCH" ? 1 : 2 });
    },
    subscribeRoom: () => () => {},
    syncMatch: async () => matchResponse(),
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.createRoom("Ada");
  assert.equal(controller.getPresentation().screen, ONLINE_SCREENS.LOBBY);
  assert.deepEqual(
    controller.getPresentation().room.seats.map(({ teamId }) => teamId),
    ["A", "B", "A", "B"],
  );

  await controller.startMatch("RAMIFICADO");
  controller.selectDomino("d:4:5");
  await controller.submitTarget({ kind: "START" });
  assert.deepEqual(calls.at(-1).intent, {
    type: "PLAY_TILE",
    dominoId: "d:4:5",
    target: { kind: "START" },
  });
  assert.equal(Object.hasOwn(calls.at(-1), "gameState"), false);
});

test("la presentación conserva solo la mano privada del asiento autenticado", () => {
  const match = matchResponse();
  const round = createOnlineRoundPresentation({ match });
  assert.deepEqual(round.view.hand.map(({ dominoId }) => dominoId), ["d:4:5"]);
  assert.equal(Object.hasOwn(match.publicMatch, "hands"), false);
  assert.equal(Object.hasOwn(match.privateMatch, "rivalHands"), false);
  assert.equal(round.handPrivacy.canAct, true);
});

test("normaliza una punta visual al target OPEN_END canónico", async () => {
  const visualTarget = {
    id: "placement-2:side:b",
    kind: "main",
    placementId: "placement-2",
    portId: "side:b",
    value: 1,
  };
  let sentIntent = null;
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async () => room(),
    subscribeRoom: () => () => {},
    syncMatch: async () => matchResponse({ target: visualTarget }),
    sendIntent: async (payload) => {
      if (payload.intent.type === "START_MATCH") {
        return matchResponse({ target: visualTarget });
      }
      sentIntent = payload.intent;
      return matchResponse({ version: 2, target: visualTarget });
    },
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.createRoom("Ada");
  await controller.startMatch();
  controller.selectDomino("d:4:5");
  await controller.submitTarget(visualTarget);
  assert.deepEqual(sentIntent.target, {
    kind: "OPEN_END",
    placementId: "placement-2",
    portId: "side:b",
  });
});

test("presenta tres CPU consecutivas en orden sin saltar versiones", async () => {
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async () => room(),
    subscribeRoom: () => () => {},
    syncMatch: async () => matchResponse(),
    sendIntent: async () => queuedMatch({ sequences: [1, 2, 3] }),
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.createRoom("Ada");
  await controller.startMatch();

  const observed = [];
  for (const expectedSequence of [1, 2, 3]) {
    let presentation = controller.getPresentation();
    assert.equal(presentation.presentationQueue.phase, "announce");
    assert.equal(presentation.round.handPrivacy.canAct, false);
    assert.equal(controller.advancePresentation(), true);
    presentation = controller.getPresentation();
    observed.push(presentation.presentationQueue.presentedSequence);
    assert.equal(presentation.presentationQueue.phase, "move");
    assert.equal(presentation.presentationQueue.presentedSequence, expectedSequence);
    assert.equal(controller.completePresentation(), true);
  }
  assert.deepEqual(observed, [1, 2, 3]);
  assert.equal(controller.getPresentation().presentationQueue.phase, "idle");
  assert.equal(controller.getPresentation().presentationQueue.pendingCount, 0);
});

test("el humano del asiento 3 espera dos presentaciones CPU completas", async () => {
  const burst = queuedMatch({
    sequences: [1, 2],
    privateSeatId: "seat-3",
    actorSeatIds: ["seat-1", "seat-2"],
    currentPlayerIds: ["seat-2", "seat-3"],
  });
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async () => room({ humanSeatIndex: 2 }),
    subscribeRoom: () => () => {},
    syncMatch: async () => matchResponse({ privateSeatId: "seat-3" }),
    sendIntent: async () => burst,
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.createRoom("Ada");
  await controller.startMatch();

  assert.equal(controller.getPresentation().presentationQueue.actorSeatId, "seat-1");
  assert.equal(controller.getPresentation().round.handPrivacy.canAct, false);
  controller.advancePresentation();
  assert.equal(controller.getPresentation().round.handPrivacy.canAct, false);
  controller.completePresentation();
  assert.equal(controller.getPresentation().presentationQueue.actorSeatId, "seat-2");
  assert.equal(controller.getPresentation().round.handPrivacy.canAct, false);
  controller.advancePresentation();
  assert.equal(controller.getPresentation().round.handPrivacy.canAct, false);
  controller.completePresentation();

  assert.equal(controller.getPresentation().presentationQueue.phase, "idle");
  assert.equal(controller.getPresentation().round.handPrivacy.canAct, true);
});

test("una nueva versión queda en cola hasta completar el scoring activo", async () => {
  let subscription = null;
  let syncResponse = matchResponse({ sequence: 2, version: 2 });
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async (intent) => intent.type === "GET_ROOM"
      ? { ...room(), status: "PLAYING", version: 3 }
      : room(),
    subscribeRoom: (_roomId, callback) => {
      subscription = callback;
      return () => {};
    },
    syncMatch: async () => syncResponse,
    sendIntent: async () => queuedMatch({ sequences: [1, 2], version: 2 }),
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.createRoom("Ada");
  await controller.startMatch();
  controller.advancePresentation();
  controller.completePresentation();
  controller.advancePresentation();
  assert.equal(controller.getPresentation().presentationQueue.presentedSequence, 2);

  syncResponse = queuedMatch({ sequences: [3], version: 3 });
  subscription();
  await controller.refresh();
  let presentation = controller.getPresentation();
  assert.equal(presentation.presentationQueue.phase, "move");
  assert.equal(presentation.presentationQueue.presentedSequence, 2);
  assert.equal(presentation.presentationQueue.pendingCount, 1);

  controller.completePresentation();
  presentation = controller.getPresentation();
  assert.equal(presentation.presentationQueue.phase, "announce");
  controller.advancePresentation();
  assert.equal(controller.getPresentation().presentationQueue.presentedSequence, 3);
});

test("reconnect sincroniza directo al snapshot actual y reinicia la cola", async () => {
  const current = queuedMatch({ sequences: [7, 8, 9], version: 9 });
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async () => ({ ...room(), status: "PLAYING", version: 9 }),
    subscribeRoom: () => () => {},
    syncMatch: async () => current,
    sendIntent: async () => current,
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.resumeRoom("ABCDE");
  const presentation = controller.getPresentation();
  assert.equal(presentation.presentationQueue.phase, "idle");
  assert.equal(presentation.presentationQueue.pendingCount, 0);
  assert.equal(presentation.presentationQueue.presentedSequence, 9);
  assert.equal(presentation.presentationQueue.authoritativeSequence, 9);
});

test("Realtime reanudado fuerza resync directo y conserva asiento, equipo y mano", async () => {
  let onSubscriptionStatus = null;
  let syncResponse = matchResponse({
    sequence: 2,
    version: 2,
    privateSeatId: "seat-3",
    currentPlayerId: "seat-1",
  });
  let syncCalls = 0;
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async () => ({
      ...room({ humanSeatIndex: 2 }),
      status: "PLAYING",
      version: syncResponse.version,
    }),
    subscribeRoom: (_roomId, _onVersion, onStatus) => {
      onSubscriptionStatus = onStatus;
      return () => {};
    },
    syncMatch: async () => {
      syncCalls += 1;
      return syncResponse;
    },
    sendIntent: async () => syncResponse,
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.resumeRoom("ABCDE");
  const before = controller.getPresentation();
  assert.equal(before.room.seats.find(({ userId }) => userId === "user-1").seatIndex, 2);
  assert.equal(before.room.seats.find(({ userId }) => userId === "user-1").teamId, "A");

  syncResponse = matchResponse({
    sequence: 5,
    version: 5,
    privateSeatId: "seat-3",
    currentPlayerId: "seat-3",
  });
  assert.equal(typeof onSubscriptionStatus, "function");
  onSubscriptionStatus("RECONNECTED");
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  const after = controller.getPresentation();
  assert.equal(syncCalls, 2);
  assert.equal(after.presentationQueue.phase, "idle");
  assert.equal(after.presentationQueue.presentedSequence, 5);
  assert.equal(after.presentationQueue.authoritativeSequence, 5);
  assert.equal(after.round.handPrivacy.playerId, "seat-3");
  assert.deepEqual(after.round.view.hand.map(({ dominoId }) => dominoId), ["d:4:5"]);
  assert.equal(after.room.seats.filter(({ userId }) => userId === "user-1").length, 1);
});

test("un resync no sustituye la identidad anónima ni intenta ocupar otro asiento", async () => {
  let identity = { id: "user-1" };
  let lobbyCalls = 0;
  const gateway = {
    ensureAnonymousIdentity: async () => identity,
    sendLobbyIntent: async () => {
      lobbyCalls += 1;
      return { ...room(), status: "PLAYING", version: 1 };
    },
    subscribeRoom: () => () => {},
    syncMatch: async () => matchResponse(),
    sendIntent: async () => matchResponse(),
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.resumeRoom("ABCDE");
  identity = { id: "otro-usuario" };
  await assert.rejects(
    controller.resync(),
    (error) => error.code === "SESSION_IDENTITY_CHANGED",
  );
  assert.equal(lobbyCalls, 1, "no debe intentar JOIN_ROOM ni GET_ROOM con otra identidad");
});

test("una sala pendiente puede reanudarse al volver la red sin crear otro asiento", async () => {
  let available = false;
  let roomReads = 0;
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async () => {
      roomReads += 1;
      if (!available) throw Object.assign(new Error("Sin red"), { code: "NETWORK" });
      return { ...room({ humanSeatIndex: 2 }), status: "PLAYING", version: 4 };
    },
    subscribeRoom: () => () => {},
    syncMatch: async () => matchResponse({
      sequence: 4,
      version: 4,
      privateSeatId: "seat-3",
    }),
    sendIntent: async () => matchResponse(),
  };
  const controller = new OnlineGameSessionController({ gateway });
  await assert.rejects(controller.start({ roomCode: "ABCDE" }), { code: "NETWORK" });
  assert.equal(controller.getPresentation().room, null);

  available = true;
  await controller.resync();
  const presentation = controller.getPresentation();
  assert.equal(roomReads, 2);
  assert.equal(presentation.room.roomCode, "ABCDE");
  assert.equal(presentation.room.seats.find(({ userId }) => userId === "user-1").seatIndex, 2);
  assert.equal(presentation.round.handPrivacy.playerId, "seat-3");
});

test("el canal distingue suscripción inicial de reconexión", () => {
  let subscriptionCallback = null;
  let removedChannel = null;
  const channel = {
    on() { return this; },
    subscribe(callback) {
      subscriptionCallback = callback;
      return this;
    },
  };
  const gateway = new SupabaseGateway({
    supabaseClient: {
      auth: {},
      functions: {},
      channel: () => channel,
      removeChannel: (removed) => { removedChannel = removed; },
    },
  });
  const statuses = [];
  const unsubscribe = gateway.subscribeRoom(
    "room-1",
    () => {},
    (status) => statuses.push(status),
  );
  subscriptionCallback("SUBSCRIBED");
  subscriptionCallback("TIMED_OUT", new Error("timeout"));
  subscriptionCallback("SUBSCRIBED");
  assert.deepEqual(statuses, ["SUBSCRIBED", "TIMED_OUT", "RECONNECTED"]);
  unsubscribe();
  assert.equal(removedChannel, channel);
});

test("una respuesta stale no altera la presentación ni pierde la selección", async () => {
  const initial = matchResponse({ sequence: 0, version: 1 });
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async () => room(),
    subscribeRoom: () => () => {},
    syncMatch: async () => initial,
    sendIntent: async (payload) => {
      if (payload.intent.type === "START_MATCH") return initial;
      throw Object.assign(new Error("STALE_VERSION"), { code: "STALE_VERSION" });
    },
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.createRoom("Ada");
  await controller.startMatch();
  controller.selectDomino("d:4:5");
  await assert.rejects(
    controller.submitTarget({ kind: "START" }),
    (error) => error.code === "STALE_VERSION",
  );
  assert.equal(controller.getPresentation().round.selectedDominoId, "d:4:5");
  assert.equal(controller.getPresentation().presentationQueue.phase, "idle");
});

test("la transición terminal permanece en cola hasta que su presentación termina", async () => {
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async () => room(),
    subscribeRoom: () => () => {},
    syncMatch: async () => matchResponse(),
    sendIntent: async () => queuedMatch({
      sequences: [1],
      version: 2,
      finalPhase: "finished",
    }),
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.createRoom("Ada");
  await controller.startMatch();
  assert.equal(controller.getPresentation().round.isFinished, false);
  controller.advancePresentation();
  assert.equal(controller.getPresentation().round.isFinished, true);
  assert.equal(controller.getPresentation().presentationQueue.phase, "move");
  controller.completePresentation();
  assert.equal(controller.getPresentation().presentationQueue.phase, "idle");
});

test("un segundo evento terminal no se pierde si el primer refresh transitorio falla", async () => {
  let subscription = null;
  let rejectFirstRefresh = null;
  let syncCalls = 0;
  const initial = matchResponse({ sequence: 1, version: 1 });
  const terminal = queuedMatch({
    sequences: [2],
    version: 2,
    finalPhase: "finished",
  });
  const gateway = {
    ensureAnonymousIdentity: async () => ({ id: "user-1" }),
    sendLobbyIntent: async (intent) => intent.type === "GET_ROOM"
      ? { ...room(), status: "FINISHED", version: 2 }
      : { ...room(), status: "PLAYING", version: 1 },
    subscribeRoom: (_roomId, onVersion) => {
      subscription = onVersion;
      return () => {};
    },
    syncMatch: async () => {
      syncCalls += 1;
      if (syncCalls === 1) return initial;
      if (syncCalls === 2) {
        return new Promise((_resolve, reject) => { rejectFirstRefresh = reject; });
      }
      return terminal;
    },
    sendIntent: async () => initial,
  };
  const controller = new OnlineGameSessionController({ gateway });
  await controller.start();
  await controller.resumeRoom("ABCDE");

  subscription();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(typeof rejectFirstRefresh, "function");
  subscription();
  rejectFirstRefresh(Object.assign(new Error("transitorio"), { code: "NETWORK" }));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  assert.equal(syncCalls, 3);
  assert.equal(controller.getPresentation().presentationQueue.phase, "announce");
  controller.advancePresentation();
  assert.equal(controller.getPresentation().round.isFinished, true);
});

test("el cliente Supabase del navegador usa solamente configuración pública", async () => {
  let captured = null;
  const auth = {};
  const functions = {};
  const gateway = await createBrowserSupabaseGateway({
    runtimeConfig: {
      onlineEnabled: true,
      supabaseUrl: "https://example.supabase.co",
      supabasePublicKey: "sb_publishable_public-example",
    },
    importSupabase: async () => ({
      createClient: (url, key, options) => {
        captured = { url, key, options };
        return { auth, functions };
      },
    }),
  });
  assert.equal(gateway.client.auth, auth);
  assert.equal(captured.key, "sb_publishable_public-example");
  assert.equal(captured.options.auth.persistSession, true);
  assert.equal(Object.hasOwn(captured.options, "serviceRole"), false);
});

test("navegar fuera y volver reutiliza un único cliente Auth, incluso con entradas simultáneas", async () => {
  let created = 0;
  const gateway = {};
  const getGateway = createBrowserGatewayProvider(async () => { created++; return gateway; });
  assert.deepEqual(await Promise.all([getGateway(), getGateway()]), [gateway, gateway]);
  assert.equal(await getGateway(), gateway);
  assert.equal(created, 1);
});

test("una importación fallida permite reintento explícito, sin bucle automático", async () => {
  let calls = 0;
  const gateway = {};
  const getGateway = createBrowserGatewayProvider(async () => {
    if (++calls === 1) throw new Error("Sin red");
    return gateway;
  });
  await assert.rejects(getGateway(), /Sin red/);
  assert.equal(calls, 1);
  assert.equal(await getGateway(), gateway);
  assert.equal(calls, 2);
});

test("un error de render al restaurar PLAYING no se convierte en pérdida de membership", async () => {
  const controller = new OnlineGameSessionController({
    gateway: {
      ensureAnonymousIdentity: async () => ({ id: "user-1" }),
      sendLobbyIntent: async () => ({ ...room(), status: "PLAYING" }),
      subscribeRoom: () => () => {},
      syncMatch: async () => matchResponse(),
    },
    onChange: () => { throw new Error("Renderer failed"); },
  });
  await assert.rejects(controller.start({ roomCode: "ABCDE" }), /Renderer failed/);
  assert.equal(controller.getPresentation().screen, ONLINE_SCREENS.ROUND);
  assert.equal(controller.getPresentation().pendingRoomCode, "ABCDE");
  assert.equal(controller.getPresentation().userId, "user-1");
});

test("una invitación ajena sí solicita JOIN sin crear identidad ni asiento adicionales", async () => {
  let calls = 0;
  const controller = new OnlineGameSessionController({ gateway: {
    ensureAnonymousIdentity: async () => ({ id: "user-2" }),
    sendLobbyIntent: async intent => {
      calls++;
      assert.equal(intent.type, "GET_ROOM");
      throw Object.assign(new Error("NOT_ROOM_MEMBER"), { code: "NOT_ROOM_MEMBER" });
    },
  } });
  await controller.start({ roomCode: "ABCDE" });
  assert.equal(controller.getPresentation().screen, ONLINE_SCREENS.JOIN);
  assert.equal(controller.getPresentation().pendingRoomCode, "ABCDE");
  assert.equal(calls, 1);
});
