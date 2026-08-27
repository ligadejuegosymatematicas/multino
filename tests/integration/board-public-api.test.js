import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPlay,
  getDerivedBranches,
  getLegalPlays,
  getOpenEndTargets,
  validateBoardState,
} from "../../src/js/game/index.js";
import {
  createBoardScenario,
  findDominoOwner,
  playDomino,
} from "../fixtures/board-scenarios.js";

test("la fachada pública expone las tres consultas/transiciones del Bloque 2", () => {
  assert.equal(typeof getOpenEndTargets, "function");
  assert.equal(typeof getLegalPlays, "function");
  assert.equal(typeof applyPlay, "function");
  assert.equal(typeof getDerivedBranches, "function");
  assert.equal(typeof validateBoardState, "function");
});

test("ARQ-PEND-004: applyPlay no altera turno, pases ni marcador", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-5" });
  const currentPlayerId = state.currentPlayerId;
  const score = structuredClone(state.score);

  state = playDomino(state, "2-5");
  state = playDomino(state, "3-5", (target) => target.value === 5);

  assert.equal(state.currentPlayerId, currentPlayerId);
  assert.equal(state.turnNumber, 1);
  assert.equal(state.consecutivePasses, 0);
  assert.deepEqual(state.score, score);
  assert.equal(state.history.length, 2);
  assert.deepEqual(state.history[1].result, {
    placementId: "placement-2",
    connectionId: "connection-1",
  });
  assert.equal("scoreAwarded" in state.history[1].result, false);
});

test("ARQ-PEND-003: un snapshot JSON cargado deriva los próximos IDs", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-5" });
  state = playDomino(state, "2-5");
  const loadedState = JSON.parse(JSON.stringify(state));
  const nextState = playDomino(
    loadedState,
    "3-5",
    (target) => target.value === 5,
  );

  assert.ok(nextState.board.placements["placement-2"]);
  assert.ok(nextState.board.connections["connection-1"]);
  assert.equal(nextState.history[1].sequence, 2);
});

test("ARQ-PEND-001/005: una jugada posterior no acepta un valor sin identidad de puerto", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-5" });
  state = playDomino(state, "2-5");
  const playerId = findDominoOwner(state, "3-5");
  const before = structuredClone(state);

  assert.throws(
    () =>
      applyPlay(state, {
        type: "PLAY_DOMINO",
        playerId,
        dominoId: "3-5",
        target: { value: 5 },
      }),
    (error) => error.code === "PLAY_REQUIRES_OPEN_END",
  );
  assert.deepEqual(state, before);
});
