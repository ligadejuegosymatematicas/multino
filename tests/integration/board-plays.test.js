import assert from "node:assert/strict";
import test from "node:test";

import { applyPlay } from "../../src/js/game/engine/PlayTransition.js";
import { getLegalPlays } from "../../src/js/game/engine/LegalPlays.js";
import { getOpenEndTargets } from "../../src/js/game/engine/BoardQueries.js";
import {
  createBoardScenario,
  findDominoOwner,
  playDomino,
} from "../fixtures/board-scenarios.js";

test("Caso A/R-008/R-031: la primera ficha usa START y crea la línea principal", () => {
  const state = createBoardScenario({ K: 1, firstDominoId: "2-5" });
  const initialPlayerId = state.currentPlayerId;
  const legalStarts = getLegalPlays(state, initialPlayerId);
  const action = legalStarts.find((play) => play.dominoId === "2-5");

  assert.equal(legalStarts.length, 7);
  assert.deepEqual(action.target, { kind: "START" });

  const nextState = applyPlay(state, action);

  assert.deepEqual(nextState.board.mainLine.placementIds, ["placement-1"]);
  assert.deepEqual(nextState.board.connections, {});
  assert.deepEqual(nextState.board.specialDoublePlacementIds, []);
  assert.equal(nextState.hands[initialPlayerId].includes("2-5"), false);
  assert.equal(state.hands[initialPlayerId].includes("2-5"), true);
  assert.deepEqual(
    getOpenEndTargets(nextState).map(({ value, portId, kind }) => ({
      value,
      portId,
      kind,
    })),
    [
      { value: 2, portId: "side:a", kind: "main" },
      { value: 5, portId: "side:b", kind: "main" },
    ],
  );
  assert.deepEqual(nextState.history[0], {
    sequence: 1,
    turn: 1,
    playerId: initialPlayerId,
    type: "PLAY_DOMINO",
    payload: {
      dominoId: "2-5",
      target: { kind: "START" },
    },
    result: {
      placementId: "placement-1",
      connectionId: null,
    },
  });
  assert.equal("scoreAwarded" in nextState.history[0].result, false);
});

test("R-008: otro jugador no recibe posibilidades para la primera jugada", () => {
  const state = createBoardScenario({ firstDominoId: "2-5" });
  const otherPlayerId = Object.keys(state.players).find(
    (playerId) => playerId !== state.currentPlayerId,
  );

  assert.deepEqual(getLegalPlays(state, otherPlayerId), []);
});

test("Caso B/R-028/R-031: extiende ambos extremos sin insertar en medio", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-5" });
  state = playDomino(state, "2-5");
  state = playDomino(
    state,
    "3-5",
    (target) => target.value === 5 && target.mainLineEnd === "end",
  );
  state = playDomino(
    state,
    "0-2",
    (target) => target.value === 2 && target.mainLineEnd === "start",
  );

  assert.deepEqual(state.board.mainLine.placementIds, [
    "placement-3",
    "placement-1",
    "placement-2",
  ]);
  assert.equal(Object.keys(state.board.connections).length, 2);
  assert.deepEqual(
    getOpenEndTargets(state).map((target) => target.value),
    [0, 3],
  );

  const secondConnection = state.board.connections["connection-2"];
  assert.equal(secondConnection.to.portId, "side:b");
  assert.equal(findDominoOwner(state, "0-2"), undefined);
});

test("R-028: una acción incompatible se rechaza sin mutar el snapshot", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-5" });
  state = playDomino(state, "2-5");
  const before = structuredClone(state);
  const playerId = findDominoOwner(state, "0-1");
  const target = getOpenEndTargets(state).find((candidate) => candidate.value === 5);

  assert.throws(
    () =>
      applyPlay(state, {
        type: "PLAY_DOMINO",
        playerId,
        dominoId: "0-1",
        target: {
          kind: "OPEN_END",
          placementId: target.placementId,
          portId: target.portId,
        },
      }),
    (error) => error.code === "INCOMPATIBLE_PLAY",
  );
  assert.deepEqual(state, before);
});
