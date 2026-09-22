import assert from "node:assert/strict";
import test from "node:test";

import {
  ONLINE_SCREENS,
  OnlineGameSessionController,
  createOnlineRoundPresentation,
} from "../../src/js/online/OnlineGameSessionController.js";
import { createBrowserSupabaseGateway } from "../../src/js/online/SupabaseBrowserClient.js";

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
  version = 1,
  target = { kind: "START" },
} = {}) {
  const graph = projectedView({ current: currentPlayerId === "seat-1" });
  graph.legalPlays[0].legalTargets = [target];
  return {
    version,
    publicMatch: {
      phase: "playing",
      currentPlayerId,
      remainingDominoCountByPlayer: { "seat-1": 1, "seat-2": 7 },
    },
    privateMatch: {
      seatId: "seat-1",
      hand: ["d:4:5"],
      dominoes: { "d:4:5": { id: "d:4:5" } },
      legalActions: currentPlayerId === "seat-1"
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

function room() {
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
      control_type: seat_index === 0 ? "HUMAN" : "CPU",
      user_id: seat_index === 0 ? "user-1" : null,
      nick: seat_index === 0 ? "Ada" : `CPU ${seat_index + 1}`,
      connection_state: seat_index === 0 ? "CONNECTED" : "SERVER",
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
