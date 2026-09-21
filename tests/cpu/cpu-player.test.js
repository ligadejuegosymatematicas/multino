import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  chooseCpuAction,
  createCpuSeatView,
  createDefaultSeats,
  createMatch,
  getAvailableActions,
  participantsFromSeats,
  ROUND_STRUCTURE_MODES,
} from "../../src/js/game/index.js";

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function createRound(seed = 1, humanCount = 1) {
  return createMatch({
    ...participantsFromSeats(createDefaultSeats({ humanCount })),
    matchId: `cpu-${seed}-${humanCount}`,
    mode: seed % 2 ? ROUND_STRUCTURE_MODES.BRANCHED : ROUND_STRUCTURE_MODES.LINEAR,
    randomSource: seededRandom(seed),
  });
}

test("la vista de CPU contiene su mano pero ninguna mano rival", () => {
  const state = createRound(7);
  const view = createCpuSeatView(state);
  assert.deepEqual(view.ownHand, state.hands[state.currentPlayerId]);
  assert.equal("hands" in view, false);
  assert.equal("dominoes" in view, false);
  const rivalId = Object.keys(state.hands).find((id) => id !== state.currentPlayerId);
  const rivalPrivateTile = state.hands[rivalId].find(
    (dominoId) => !view.ownHand.includes(dominoId),
  );
  assert.equal(JSON.stringify(view).includes(`\"${rivalPrivateTile}\"`), false);
});

test("la CPU elige una acción canónica y nunca pasa si existe jugada", () => {
  const state = createRound(11);
  const available = getAvailableActions(state);
  const selected = chooseCpuAction(createCpuSeatView(state));
  assert.deepEqual(
    available.some((action) => JSON.stringify(action) === JSON.stringify(selected)),
    true,
  );
  if (available.some((action) => action.type === "PLAY_DOMINO")) {
    assert.equal(selected.type, "PLAY_DOMINO");
  }
});

test("la CPU favorece el mayor puntaje inmediato", () => {
  let state = createRound(23);
  for (let turn = 0; turn < 20 && state.phase === "playing"; turn += 1) {
    const view = createCpuSeatView(state);
    const scoring = view.legalActions.filter(
      (action) => action.type === "PLAY_DOMINO" && action.evaluation.scoreAwarded > 0,
    );
    if (scoring.length > 1) {
      const selected = chooseCpuAction(view);
      const selectedProjection = scoring.find((action) =>
        action.dominoId === selected.dominoId &&
        JSON.stringify(action.target) === JSON.stringify(selected.target)
      );
      assert.equal(
        selectedProjection.evaluation.scoreAwarded,
        Math.max(...scoring.map((action) => action.evaluation.scoreAwarded)),
      );
      return;
    }
    state = applyTurnAction(state, chooseCpuAction(view));
  }
});

test("stress CPU: las cuatro composiciones terminan rondas válidas", () => {
  let completed = 0;
  for (const humanCount of [1, 2, 3, 4]) {
    for (let seed = 1; seed <= 25; seed += 1) {
      let state = createRound(seed * 37 + humanCount, humanCount);
      for (let turn = 0; turn < 150 && state.phase === "playing"; turn += 1) {
        const action = chooseCpuAction(createCpuSeatView(state));
        assert.equal(action.playerId, state.currentPlayerId);
        state = applyTurnAction(state, action);
      }
      assert.equal(state.phase, "finished", `seed=${seed}, humans=${humanCount}`);
      completed += 1;
    }
  }
  assert.equal(completed, 100);
});
