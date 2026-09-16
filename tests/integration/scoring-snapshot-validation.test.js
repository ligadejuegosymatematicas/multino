import test from "node:test";

import {
  applyTurnAction,
  createMatch,
  getAvailableActions,
  validateRoundState,
} from "../../src/js/game/index.js";
import { ensureDominoInHand } from "../fixtures/board-scenarios.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";
import { createValidParticipantInput } from "../fixtures/participants.js";
import { createBlockedTurnState } from "../fixtures/turn-scenarios.js";

function createScoredState() {
  let state = createMatch({
    ...createValidParticipantInput(),
    randomSource: () => 0.25,
  });
  state = ensureDominoInHand(state, state.currentPlayerId, "5-5");
  const action = getAvailableActions(state).find(
    (candidate) => candidate.dominoId === "5-5",
  );
  return applyTurnAction(state, action);
}

function expectCorruption(state, code, mutate) {
  const corrupt = structuredClone(state);
  mutate(corrupt);
  assertThrowsDomainCode(() => validateRoundState(corrupt), code);
}

test("score rechaza valores negativos, fraccionarios y equipos inexistentes", () => {
  const state = createScoredState();
  const scoringTeamId = state.players[state.history[0].playerId].teamId;

  expectCorruption(state, "INVALID_SCORE", (snapshot) => {
    snapshot.score.teams[scoringTeamId] = -1;
  });
  expectCorruption(state, "INVALID_SCORE", (snapshot) => {
    snapshot.score.teams[scoringTeamId] = 1.5;
  });
  expectCorruption(state, "INVALID_SCORE", (snapshot) => {
    snapshot.score.teams.UNKNOWN = 0;
  });
});

test("score actual debe coincidir exactamente con la suma del historial por equipo", () => {
  const state = createScoredState();
  const scoringTeamId = state.players[state.history[0].playerId].teamId;

  expectCorruption(state, "SCORE_HISTORY_MISMATCH", (snapshot) => {
    snapshot.score.teams[scoringTeamId] += 1;
  });

  expectCorruption(state, "SCORE_HISTORY_MISMATCH", (snapshot) => {
    const otherTeamId = Object.keys(snapshot.teams).find(
      (teamId) => teamId !== scoringTeamId,
    );
    snapshot.score.teams[scoringTeamId] -= 2;
    snapshot.score.teams[otherTeamId] += 2;
  });
});

test("PLAY_DOMINO rechaza scoreAwarded negativo o incompatible con S", () => {
  const state = createScoredState();

  expectCorruption(state, "INVALID_PLAY_SCORING", (snapshot) => {
    snapshot.history[0].result.scoreAwarded = -1;
  });
  expectCorruption(state, "INVALID_PLAY_SCORING", (snapshot) => {
    snapshot.history[0].result.scoreAwarded = 1;
  });
});

test("PLAY_DOMINO rechaza openEndsSum inválido o incoherente con el tablero actual", () => {
  const state = createScoredState();

  expectCorruption(state, "INVALID_PLAY_SCORING", (snapshot) => {
    snapshot.history[0].result.openEndsSum = -5;
  });
  expectCorruption(state, "INVALID_PLAY_SCORING", (snapshot) => {
    snapshot.history[0].result.openEndsSum = 2.5;
  });
  expectCorruption(state, "OPEN_ENDS_SUM_MISMATCH", (snapshot) => {
    const teamId = snapshot.players[snapshot.history[0].playerId].teamId;
    snapshot.history[0].result.openEndsSum = 5;
    snapshot.history[0].result.scoreAwarded = 1;
    snapshot.score.teams[teamId] = 1;
  });
});

test("PASS no puede contener puntuación ni justificar cambios de marcador", () => {
  let state = createBlockedTurnState();
  state = applyTurnAction(state, {
    type: "PASS",
    playerId: state.currentPlayerId,
  });

  expectCorruption(state, "INVALID_PASS_HISTORY", (snapshot) => {
    snapshot.history.at(-1).result.scoreAwarded = 0;
  });
  expectCorruption(state, "SCORE_HISTORY_MISMATCH", (snapshot) => {
    const teamId = snapshot.players[snapshot.history.at(-1).playerId].teamId;
    snapshot.score.teams[teamId] += 1;
  });
});
