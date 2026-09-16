import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  createMatch,
  getAvailableActions,
  getCounterclockwiseSuccessor,
  validateRoundState,
} from "../../src/js/game/index.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";
import { createValidParticipantInput } from "../fixtures/participants.js";
import {
  createBlockedTurnState,
  createPassThenPlayState,
} from "../fixtures/turn-scenarios.js";

function createInitialState() {
  return createMatch({
    ...createValidParticipantInput(),
    randomSource: () => 0.25,
  });
}

test("R-007/R-008: la primera acción pertenece al poseedor de 6-6 y ofrece siete START", () => {
  const state = createInitialState();
  const actions = getAvailableActions(state);

  assert.equal(state.hands[state.currentPlayerId].includes("6-6"), true);
  assert.equal(actions.length, 7);
  assert.ok(
    actions.every(
      (action) =>
        action.type === "PLAY_DOMINO" &&
        action.playerId === state.currentPlayerId &&
        action.target.kind === "START",
    ),
  );
  assert.equal(actions.some((action) => action.type === "PASS"), false);
});

test("R-009/R-010: una jugada reglamentaria avanza turno y agrega un solo evento", () => {
  const state = createInitialState();
  const scoreBefore = structuredClone(state.score);
  const action = getAvailableActions(state).find(
    (candidate) => candidate.dominoId !== "6-6",
  );
  const expectedNextPlayerId = getCounterclockwiseSuccessor(
    state.seating,
    state.currentPlayerId,
  );

  const nextState = applyTurnAction(state, action);

  assert.equal(nextState.currentPlayerId, expectedNextPlayerId);
  assert.equal(nextState.turnNumber, 2);
  assert.equal(nextState.consecutivePasses, 0);
  assert.equal(nextState.history.length, state.history.length + 1);
  assert.equal(nextState.history[0].turn, 1);
  assert.equal(nextState.history[0].sequence, 1);
  assert.equal(nextState.history[0].type, "PLAY_DOMINO");
  const { openEndsSum, scoreAwarded } = nextState.history[0].result;
  assert.equal(Number.isSafeInteger(openEndsSum), true);
  assert.equal(Number.isSafeInteger(scoreAwarded), true);
  const scoringTeamId = state.players[state.currentPlayerId].teamId;
  assert.equal(
    nextState.score.teams[scoringTeamId],
    scoreBefore.teams[scoringTeamId] + scoreAwarded,
  );
  assert.deepEqual(state.history, []);
  assert.equal(state.turnNumber, 1);
  assert.equal(validateRoundState(nextState), nextState);
});

test("restricción de turno: PLAY_DOMINO y PASS de otro jugador se rechazan sin mutar", () => {
  const state = createInitialState();
  const before = structuredClone(state);
  const wrongPlayerId = getCounterclockwiseSuccessor(
    state.seating,
    state.currentPlayerId,
  );
  const legalPlay = getAvailableActions(state)[0];

  assertThrowsDomainCode(
    () =>
      applyTurnAction(state, {
        ...legalPlay,
        playerId: wrongPlayerId,
      }),
    "OUT_OF_TURN",
  );
  assertThrowsDomainCode(
    () =>
      applyTurnAction(state, {
        type: "PASS",
        playerId: wrongPlayerId,
      }),
    "OUT_OF_TURN",
  );
  assert.deepEqual(state, before);
});

test("R-011: PASS es ilegal en el tablero vacío y no muta el snapshot", () => {
  const state = createInitialState();
  const before = structuredClone(state);

  assert.equal(getAvailableActions(state).length, 7);
  assertThrowsDomainCode(
    () =>
      applyTurnAction(state, {
        type: "PASS",
        playerId: state.currentPlayerId,
      }),
    "PASS_NOT_ALLOWED",
  );
  assert.deepEqual(state, before);
});

test("R-011: PASS también se rechaza con una jugada disponible en tablero ocupado", () => {
  const state = createPassThenPlayState(0);
  const before = structuredClone(state);

  assert.ok(
    getAvailableActions(state).some(
      (action) => action.type === "PLAY_DOMINO",
    ),
  );
  assertThrowsDomainCode(
    () =>
      applyTurnAction(state, {
        type: "PASS",
        playerId: state.currentPlayerId,
      }),
    "PASS_NOT_ALLOWED",
  );
  assert.deepEqual(state, before);
});

test("R-011: PASS legal avanza antihorario, incrementa turno y registra evento canónico", () => {
  const state = createBlockedTurnState();
  const before = structuredClone(state);
  const expectedNextPlayerId = getCounterclockwiseSuccessor(
    state.seating,
    state.currentPlayerId,
  );
  const actions = getAvailableActions(state);

  assert.deepEqual(actions, [
    { type: "PASS", playerId: state.currentPlayerId },
  ]);
  const nextState = applyTurnAction(state, actions[0]);

  assert.equal(nextState.currentPlayerId, expectedNextPlayerId);
  assert.equal(nextState.turnNumber, state.turnNumber + 1);
  assert.equal(nextState.consecutivePasses, 1);
  assert.equal(nextState.history.length, state.history.length + 1);
  assert.deepEqual(nextState.history.at(-1), {
    sequence: state.history.length + 1,
    turn: state.turnNumber,
    playerId: state.currentPlayerId,
    type: "PASS",
    payload: {},
    result: {},
  });
  assert.deepEqual(state, before);
});
