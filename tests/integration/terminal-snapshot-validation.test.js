import test from "node:test";

import {
  applyTurnAction,
  getAvailableActions,
  validateRoundState,
} from "../../src/js/game/index.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";
import {
  createBlockedTurnState,
  createExitTurnState,
} from "../fixtures/turn-scenarios.js";

function finishedByExit() {
  const state = createExitTurnState();
  return applyTurnAction(state, getAvailableActions(state)[0]);
}

function finishedByBlock() {
  let state = createBlockedTurnState();
  for (let index = 0; index < 4; index += 1) {
    state = applyTurnAction(state, {
      type: "PASS",
      playerId: state.currentPlayerId,
    });
  }
  return state;
}

function expectCorruption(state, code, mutate) {
  const corrupt = structuredClone(state);
  mutate(corrupt);
  assertThrowsDomainCode(() => validateRoundState(corrupt), code);
}

test("phase=playing no admite roundResult", () => {
  const state = createBlockedTurnState();
  expectCorruption(state, "UNEXPECTED_ROUND_RESULT", (snapshot) => {
    snapshot.roundResult = { reason: "BLOCKED" };
  });
});

test("la fase debe ser playing o finished", () => {
  const state = createBlockedTurnState();
  expectCorruption(state, "INVALID_PLAYABLE_STATE", (snapshot) => {
    snapshot.phase = "stopped";
  });
});

test("phase=finished requiere roundResult y conserva el turno terminal", () => {
  const state = finishedByExit();
  expectCorruption(state, "INVALID_ROUND_RESULT", (snapshot) => {
    delete snapshot.roundResult;
  });
  expectCorruption(state, "INVALID_FINISHED_ROUND_STATE", (snapshot) => {
    snapshot.turnNumber += 1;
  });
});

test("EMPTY_HAND exige jugador, equipo y mano vacía coherentes", () => {
  const state = finishedByExit();
  expectCorruption(state, "INVALID_EMPTY_HAND_RESULT", (snapshot) => {
    snapshot.roundResult.finishingTeamId =
      snapshot.roundResult.finishingTeamId === "A" ? "B" : "A";
  });
  expectCorruption(state, "INVALID_EMPTY_HAND_RESULT", (snapshot) => {
    const donorId = Object.keys(snapshot.hands).find(
      (playerId) => playerId !== snapshot.roundResult.finishingPlayerId,
    );
    snapshot.hands[snapshot.roundResult.finishingPlayerId].push(
      snapshot.hands[donorId].pop(),
    );
  });
});

test("BLOCKED exige cuatro pases, resultado mínimo y actor terminal", () => {
  const state = finishedByBlock();
  expectCorruption(state, "INVALID_CONSECUTIVE_PASSES", (snapshot) => {
    snapshot.consecutivePasses = 3;
  });
  expectCorruption(state, "INVALID_BLOCKED_RESULT", (snapshot) => {
    snapshot.roundResult.finishingPlayerId = snapshot.currentPlayerId;
  });
  expectCorruption(state, "INVALID_TERMINAL_CURRENT_PLAYER", (snapshot) => {
    snapshot.currentPlayerId = snapshot.seating.counterclockwisePlayerIds.find(
      (playerId) => playerId !== snapshot.currentPlayerId,
    );
  });
});

test("history PASS rechaza resultado redundante o ficticio", () => {
  const state = finishedByBlock();
  expectCorruption(state, "INVALID_PASS_HISTORY", (snapshot) => {
    snapshot.history.at(-1).result.consecutivePassesAfter = 4;
  });
  expectCorruption(state, "INVALID_REGULATORY_HISTORY_TURN", (snapshot) => {
    snapshot.history.at(-1).turn -= 1;
  });
});
