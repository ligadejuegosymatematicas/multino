import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPlay,
  applyTurnAction,
  getAvailableActions,
  getCounterclockwiseSuccessor,
  validateRoundState,
} from "../../src/js/game/index.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";
import {
  createBlockedTurnState,
  createExitTurnState,
  createPassThenPlayState,
} from "../fixtures/turn-scenarios.js";

function passCurrentPlayer(state) {
  return applyTurnAction(state, {
    type: "PASS",
    playerId: state.currentPlayerId,
  });
}

test("R-012/R-013: cuatro pases exactos terminan por BLOCKED sin quinto turno", () => {
  let state = createBlockedTurnState();
  const initialHistoryLength = state.history.length;
  const initialTurnNumber = state.turnNumber;
  const passers = [];

  for (let passNumber = 1; passNumber <= 4; passNumber += 1) {
    const actingPlayerId = state.currentPlayerId;
    const expectedNextPlayerId = getCounterclockwiseSuccessor(
      state.seating,
      actingPlayerId,
    );
    passers.push(actingPlayerId);
    state = passCurrentPlayer(state);

    assert.equal(state.consecutivePasses, passNumber);
    if (passNumber < 4) {
      assert.equal(state.phase, "playing");
      assert.equal(state.currentPlayerId, expectedNextPlayerId);
      assert.equal(state.turnNumber, initialTurnNumber + passNumber);
    }
  }

  assert.equal(new Set(passers).size, 4);
  assert.equal(state.phase, "finished");
  assert.deepEqual(state.roundResult, { reason: "BLOCKED" });
  assert.equal(state.currentPlayerId, passers[3]);
  assert.equal(state.turnNumber, initialTurnNumber + 3);
  assert.equal(state.history.length, initialHistoryLength + 4);
  assert.deepEqual(
    state.history.slice(-4).map(({ turn, type, payload, result }) => ({
      turn,
      type,
      payload,
      result,
    })),
    [0, 1, 2, 3].map((offset) => ({
      turn: initialTurnNumber + offset,
      type: "PASS",
      payload: {},
      result: {},
    })),
  );
  assert.equal(validateRoundState(state), state);
  assert.equal(
    validateRoundState(JSON.parse(JSON.stringify(state))).phase,
    "finished",
  );
  assert.deepEqual(getAvailableActions(state), []);
  assertThrowsDomainCode(
    () => passCurrentPlayer(state),
    "ROUND_ALREADY_FINISHED",
  );
});

for (const passCount of [1, 2, 3]) {
  test(`una jugada legal después de ${passCount} pase(s) reinicia consecutivePasses`, () => {
    let state = createPassThenPlayState(passCount);
    for (let index = 0; index < passCount; index += 1) {
      state = passCurrentPlayer(state);
    }
    assert.equal(state.consecutivePasses, passCount);

    const play = getAvailableActions(state).find(
      (action) => action.type === "PLAY_DOMINO" && action.dominoId === "0-5",
    );
    assert.ok(play);
    const turnBefore = state.turnNumber;
    const historyBefore = state.history.length;

    state = applyTurnAction(state, play);

    assert.equal(state.phase, "playing");
    assert.equal(state.consecutivePasses, 0);
    assert.equal(state.turnNumber, turnBefore + 1);
    assert.equal(state.history.length, historyBefore + 1);
    assert.equal(state.history.at(-1).type, "PLAY_DOMINO");
    assert.equal(state.history.at(-1).turn, turnBefore);
    assert.equal("roundResult" in state, false);
  });
}

test("R-013/R-020: jugar la última ficha termina por EMPTY_HAND sin avanzar", () => {
  const state = createExitTurnState();
  const finishingPlayerId = state.currentPlayerId;
  const finishingTeamId = state.players[finishingPlayerId].teamId;
  const turnNumber = state.turnNumber;
  const scoreBefore = structuredClone(state.score);
  const action = getAvailableActions(state).find(
    (candidate) => candidate.dominoId === "0-5",
  );

  const finished = applyTurnAction(state, action);

  assert.equal(finished.hands[finishingPlayerId].length, 0);
  assert.equal(finished.phase, "finished");
  assert.deepEqual(finished.roundResult, {
    reason: "EMPTY_HAND",
    finishingPlayerId,
    finishingTeamId,
  });
  assert.equal(finished.currentPlayerId, finishingPlayerId);
  assert.equal(finished.turnNumber, turnNumber);
  assert.equal(finished.turnNumber, finished.history.length);
  assert.equal(finished.consecutivePasses, 0);
  assert.deepEqual(finished.score, scoreBefore);
  assert.equal("finalScore" in finished.roundResult, false);
  assert.equal("bonus" in finished.roundResult, false);
  assert.equal("winnerByScore" in finished.roundResult, false);
  assert.equal(validateRoundState(finished), finished);
  assert.equal(
    validateRoundState(JSON.parse(JSON.stringify(finished))).phase,
    "finished",
  );
});

test("una ronda finished rechaza PLAY_DOMINO y PASS sin mutar", () => {
  const active = createExitTurnState();
  const finished = applyTurnAction(active, getAvailableActions(active)[0]);
  const before = structuredClone(finished);

  assertThrowsDomainCode(
    () =>
      applyTurnAction(finished, {
        type: "PASS",
        playerId: finished.currentPlayerId,
      }),
    "ROUND_ALREADY_FINISHED",
  );
  assertThrowsDomainCode(
    () =>
      applyTurnAction(finished, {
        type: "PLAY_DOMINO",
        playerId: finished.currentPlayerId,
        dominoId: "1-1",
        target: { kind: "START" },
      }),
    "ROUND_ALREADY_FINISHED",
  );
  assertThrowsDomainCode(
    () =>
      applyPlay(finished, {
        type: "PLAY_DOMINO",
        playerId: finished.currentPlayerId,
        dominoId: "1-1",
        target: { kind: "START" },
      }),
    "ROUND_ALREADY_FINISHED",
  );
  assert.deepEqual(finished, before);
});
