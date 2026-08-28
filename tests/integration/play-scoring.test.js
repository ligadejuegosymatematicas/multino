import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  createMatch,
  getAvailableActions,
  getOpenEndTargets,
  validateRoundState,
} from "../../src/js/game/index.js";
import { ensureDominoInHand } from "../fixtures/board-scenarios.js";
import { createValidParticipantInput } from "../fixtures/participants.js";
import {
  createBlockedTurnState,
  createExitTurnState,
} from "../fixtures/turn-scenarios.js";

function createInitialState(firstDominoId) {
  const state = createMatch({
    ...createValidParticipantInput(),
    K: 1,
    randomSource: () => 0.25,
  });
  return ensureDominoInHand(
    state,
    state.currentPlayerId,
    firstDominoId,
  );
}

function playByDominoId(state, dominoId, targetValue = null) {
  const matchingTarget =
    targetValue === null
      ? null
      : getOpenEndTargets(state).find(
          (target) => target.value === targetValue,
        );
  const action = getAvailableActions(state).find(
    (candidate) =>
      candidate.type === "PLAY_DOMINO" &&
      candidate.dominoId === dominoId &&
      (targetValue === null ||
        (candidate.target.placementId === matchingTarget?.placementId &&
          candidate.target.portId === matchingTarget?.portId)),
  );
  assert.ok(action, `No se encontró jugada reglamentaria para ${dominoId}.`);
  return applyTurnAction(state, action);
}

function assignTurnDominoes(state, assignments) {
  const nextState = structuredClone(state);
  const protectedIds = new Set(assignments.map(([, dominoId]) => dominoId));
  for (const [playerId, dominoId] of assignments) {
    if (nextState.hands[playerId].includes(dominoId)) {
      continue;
    }
    const ownerId = Object.entries(nextState.hands).find(([, hand]) =>
      hand.includes(dominoId),
    )[0];
    const replacementId = nextState.hands[playerId].find(
      (candidateId) =>
        candidateId !== "6-6" && !protectedIds.has(candidateId),
    );
    const desiredIndex = nextState.hands[ownerId].indexOf(dominoId);
    const replacementIndex = nextState.hands[playerId].indexOf(replacementId);
    nextState.hands[ownerId][desiredIndex] = replacementId;
    nextState.hands[playerId][replacementIndex] = dominoId;
  }
  return validateRoundState(nextState);
}

for (const [dominoId, expectedSum, expectedPoints] of [
  ["5-5", 10, 2],
  ["4-6", 10, 2],
  ["2-3", 5, 1],
]) {
  test(`R-014/R-015: la primera jugada ${dominoId} registra S=${expectedSum} y +${expectedPoints}`, () => {
    const state = createInitialState(dominoId);
    const actingPlayerId = state.currentPlayerId;
    const actingTeamId = state.players[actingPlayerId].teamId;
    const otherTeamId = Object.keys(state.teams).find(
      (teamId) => teamId !== actingTeamId,
    );

    const nextState = playByDominoId(state, dominoId);

    assert.equal(nextState.history.length, 1);
    assert.equal(nextState.history[0].result.openEndsSum, expectedSum);
    assert.equal(nextState.history[0].result.scoreAwarded, expectedPoints);
    assert.equal(nextState.score.teams[actingTeamId], expectedPoints);
    assert.equal(nextState.score.teams[otherTeamId], 0);
    assert.deepEqual(state.score.teams, { A: 0, B: 0 });
    assert.equal(validateRoundState(nextState), nextState);
  });
}

test("la puntuación se acumula 0 → +2 → +0 → +3 para el mismo equipo", () => {
  let state = createInitialState("4-6");
  const startingIndex = state.seating.counterclockwisePlayerIds.indexOf(
    state.currentPlayerId,
  );
  const order = [0, 1, 2, 3].map(
    (offset) =>
      state.seating.counterclockwisePlayerIds[(startingIndex + offset) % 4],
  );
  state = assignTurnDominoes(state, [
    [order[0], "4-6"],
    [order[1], "2-4"],
    [order[2], "1-2"],
    [order[3], "1-3"],
  ]);
  const scoringTeamId = state.players[order[0]].teamId;
  assert.equal(state.players[order[2]].teamId, scoringTeamId);
  assert.deepEqual(state.score.teams, { A: 0, B: 0 });

  state = playByDominoId(state, "4-6");
  assert.equal(state.history.at(-1).result.scoreAwarded, 2);
  assert.equal(state.score.teams[scoringTeamId], 2);

  state = playByDominoId(state, "2-4", 4);
  state = playByDominoId(state, "1-2", 2);
  assert.equal(state.history.at(-1).result.openEndsSum, 7);
  assert.equal(state.history.at(-1).result.scoreAwarded, 0);
  assert.equal(state.score.teams[scoringTeamId], 2);

  state = playByDominoId(state, "1-3", 1);
  state = playByDominoId(state, "6-6", 6);
  assert.equal(state.currentPlayerId, order[1]);
  assert.equal(state.history.at(-1).result.openEndsSum, 15);
  assert.equal(state.history.at(-1).result.scoreAwarded, 3);
  assert.equal(state.score.teams[scoringTeamId], 5);
  assert.equal(validateRoundState(state), state);
});

test("PASS no puntúa y el cuarto solo aplica la bonificación terminal", () => {
  let state = createBlockedTurnState();
  const scoreBefore = structuredClone(state.score);
  for (let index = 0; index < 4; index += 1) {
    state = applyTurnAction(state, {
      type: "PASS",
      playerId: state.currentPlayerId,
    });
    if (index < 3) {
      assert.deepEqual(state.score, scoreBefore);
    }
  }

  assert.equal(state.phase, "finished");
  assert.equal(state.roundResult.reason, "BLOCKED");
  const winnerTeamId = state.roundResult.traditionalWinnerTeamId;
  assert.equal(
    state.score.teams[winnerTeamId],
    scoreBefore.teams[winnerTeamId] + state.roundResult.finalBonus,
  );
  assert.deepEqual(state.history.at(-1).result, {});
  assert.equal("scoreAwarded" in state.history.at(-1).result, false);
  assert.equal("openEndsSum" in state.history.at(-1).result, false);
});

test("R-017: una jugada terminal puntúa antes de terminar por EMPTY_HAND", () => {
  const state = createExitTurnState();
  const playerId = state.currentPlayerId;
  const teamId = state.players[playerId].teamId;
  const scoreBefore = state.score.teams[teamId];
  const turnBefore = state.turnNumber;

  const finished = playByDominoId(state, "0-5", 0);

  assert.equal(finished.history.at(-1).result.openEndsSum, 5);
  assert.equal(finished.history.at(-1).result.scoreAwarded, 1);
  assert.equal(
    finished.score.teams[teamId],
    scoreBefore + 1 + finished.roundResult.finalBonus,
  );
  assert.equal(finished.phase, "finished");
  assert.equal(finished.roundResult.reason, "EMPTY_HAND");
  assert.equal(finished.currentPlayerId, playerId);
  assert.equal(finished.turnNumber, turnBefore);
});
