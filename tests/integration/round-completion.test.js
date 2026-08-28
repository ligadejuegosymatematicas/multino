import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  calculateFinalBonus,
  getAvailableActions,
  validateRoundState,
} from "../../src/js/game/index.js";
import {
  createBlockedOutcomeState,
  createExitTurnState,
} from "../fixtures/turn-scenarios.js";

function finishByBlock(initialState) {
  let state = initialState;
  for (let index = 0; index < 4; index += 1) {
    state = applyTurnAction(state, {
      type: "PASS",
      playerId: state.currentPlayerId,
    });
  }
  return state;
}

function finishByExit(initialState, dominoId) {
  const action = getAvailableActions(initialState).find(
    (candidate) => candidate.dominoId === dominoId,
  );
  assert.ok(action);
  return applyTurnAction(initialState, action);
}

function setHistoricalTeamScore(state, teamId, targetScore) {
  const nextState = structuredClone(state);
  const entries = nextState.history.filter(
    (entry) =>
      entry.type === "PLAY_DOMINO" &&
      nextState.players[entry.playerId].teamId === teamId,
  );
  let remaining = targetScore;
  for (const entry of entries) {
    const scoreAwarded = Math.min(remaining, 6);
    entry.result.openEndsSum = scoreAwarded * 5;
    entry.result.scoreAwarded = scoreAwarded;
    remaining -= scoreAwarded;
  }
  assert.equal(remaining, 0);
  nextState.score.teams[teamId] = targetScore;
  return validateRoundState(nextState);
}

test("R-020/R-023: salida sin puntos en la última jugada aplica solo bonificación", () => {
  const state = createExitTurnState("0-6");
  const playerId = state.currentPlayerId;
  const teamId = state.players[playerId].teamId;
  const scoreBefore = state.score.teams[teamId];
  const historyBefore = state.history.length;

  const finished = finishByExit(state, "0-6");

  assert.equal(finished.history.length, historyBefore + 1);
  assert.equal(finished.history.at(-1).type, "PLAY_DOMINO");
  assert.equal(finished.history.at(-1).result.openEndsSum, 6);
  assert.equal(finished.history.at(-1).result.scoreAwarded, 0);
  assert.equal(finished.roundResult.traditionalWinnerTeamId, teamId);
  const otherTeamId = Object.keys(finished.teams).find(
    (candidateTeamId) => candidateTeamId !== teamId,
  );
  assert.equal(
    finished.roundResult.finalBonus,
    calculateFinalBonus(
      finished.roundResult.remainingPipsByTeam[otherTeamId],
    ),
  );
  assert.equal(
    finished.score.teams[teamId],
    scoreBefore + finished.roundResult.finalBonus,
  );
  assert.equal(finished.history.some((entry) => entry.type === "ROUND_FINISHED"), false);
});

test("R-017/R-020/R-023: salida puntúa la última ficha antes de bonificar", () => {
  const state = createExitTurnState("0-5");
  const teamId = state.players[state.currentPlayerId].teamId;
  const scoreBefore = state.score.teams[teamId];

  const finished = finishByExit(state, "0-5");

  assert.equal(finished.history.at(-1).result.scoreAwarded, 1);
  assert.equal(
    finished.score.teams[teamId],
    scoreBefore + 1 + finished.roundResult.finalBonus,
  );
  assert.equal(finished.phase, "finished");
  assert.equal(finished.roundResult.reason, "EMPTY_HAND");
});

for (const [traditionalWinnerTeamId, remainingPipsByTeam, finalBonus] of [
  ["A", { A: 6, B: 120 }, 24],
  ["B", { A: 112, B: 14 }, 22],
]) {
  test(`R-021/R-023: tranque reconoce vencedor tradicional ${traditionalWinnerTeamId}`, () => {
    const finished = finishByBlock(
      createBlockedOutcomeState(traditionalWinnerTeamId),
    );

    assert.equal(finished.phase, "finished");
    assert.equal(finished.roundResult.reason, "BLOCKED");
    assert.deepEqual(
      finished.roundResult.remainingPipsByTeam,
      remainingPipsByTeam,
    );
    assert.equal(
      finished.roundResult.traditionalWinnerTeamId,
      traditionalWinnerTeamId,
    );
    assert.equal(finished.roundResult.finalBonus, finalBonus);
    assert.equal(validateRoundState(finished), finished);
  });
}

test("R-022: igualdad de fichas en tranque no produce vencedor ni bonificación", () => {
  const finished = finishByBlock(createBlockedOutcomeState("TIE"));

  assert.deepEqual(finished.roundResult.remainingPipsByTeam, { A: 63, B: 63 });
  assert.equal(finished.roundResult.traditionalWinnerTeamId, null);
  assert.equal(finished.roundResult.finalBonus, 0);
  assert.equal(finished.roundResult.winnerTeamId, "A");
  assert.equal(finished.roundResult.isTie, false);
});

test("R-024/R-025: vencedor tradicional y ganador por puntaje pueden diferir", () => {
  const active = setHistoricalTeamScore(
    createBlockedOutcomeState("A"),
    "B",
    26,
  );

  const finished = finishByBlock(active);

  assert.equal(finished.roundResult.traditionalWinnerTeamId, "A");
  assert.equal(finished.roundResult.finalBonus, 24);
  assert.deepEqual(finished.score.teams, { A: 25, B: 26 });
  assert.equal(finished.roundResult.winnerTeamId, "B");
  assert.equal(finished.roundResult.isTie, false);
});

test("R-026: el puntaje final igual representa ganador nulo y empate", () => {
  const active = setHistoricalTeamScore(
    createBlockedOutcomeState("A"),
    "B",
    25,
  );

  const finished = finishByBlock(active);

  assert.equal(finished.roundResult.traditionalWinnerTeamId, "A");
  assert.deepEqual(finished.score.teams, { A: 25, B: 25 });
  assert.equal(finished.roundResult.winnerTeamId, null);
  assert.equal(finished.roundResult.isTie, true);
});

test("el cuarto PASS conserva un único evento terminal y no crea quinto turno", () => {
  const active = createBlockedOutcomeState("B");
  const historyBefore = active.history.length;
  const turnBefore = active.turnNumber;
  const finished = finishByBlock(active);

  assert.equal(finished.history.length, historyBefore + 4);
  assert.equal(finished.history.at(-1).type, "PASS");
  assert.deepEqual(finished.history.at(-1).result, {});
  assert.equal(finished.history.some((entry) => entry.type === "ROUND_FINISHED"), false);
  assert.equal(finished.turnNumber, turnBefore + 3);
  assert.equal(finished.turnNumber, finished.history.length);
});
