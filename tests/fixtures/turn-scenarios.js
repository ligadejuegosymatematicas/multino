import { getOpenEndTargets } from "../../src/js/game/engine/BoardQueries.js";
import { validateRoundState } from "../../src/js/game/engine/RoundValidator.js";
import { getCounterclockwiseSuccessor } from "../../src/js/game/setup/Seating.js";
import { STARTING_DOMINO_ID } from "../../src/js/game/setup/StartingPlayer.js";
import {
  createBoardScenario,
  findDominoOwner,
  playDomino,
} from "./board-scenarios.js";

const CLOSED_ZERO_CHAIN = Object.freeze([
  "0-0",
  "0-1",
  "1-2",
  "0-2",
  "0-3",
  "3-4",
  "0-4",
  "0-5",
  "5-6",
  "0-6",
]);

const RECOVERABLE_ZERO_CHAIN = Object.freeze([
  "0-0",
  "0-1",
  "1-2",
  "0-2",
  "0-3",
  "3-4",
  "0-4",
]);

function buildZeroEndedMainLine(dominoIds) {
  let state = createBoardScenario({ K: 0, firstDominoId: dominoIds[0] });
  state = playDomino(state, dominoIds[0]);
  for (const dominoId of dominoIds.slice(1)) {
    state = playDomino(
      state,
      dominoId,
      (target) => target.kind === "main" && target.mainLineEnd === "end",
    );
  }
  return state;
}

function getStartingPlayerId(state) {
  return findDominoOwner(state, STARTING_DOMINO_ID);
}

function normalizeRegulatoryHistory(state) {
  const nextState = structuredClone(state);
  const playerIds = nextState.seating.counterclockwisePlayerIds;
  const startingPlayerId = getStartingPlayerId(nextState);
  const startingIndex = playerIds.indexOf(startingPlayerId);

  nextState.history.forEach((entry, index) => {
    entry.sequence = index + 1;
    entry.turn = index + 1;
    entry.playerId = playerIds[(startingIndex + index) % playerIds.length];
  });
  nextState.currentPlayerId =
    playerIds[(startingIndex + nextState.history.length) % playerIds.length];
  nextState.turnNumber = nextState.history.length + 1;
  nextState.consecutivePasses = 0;
  nextState.phase = "playing";
  delete nextState.roundResult;
  return nextState;
}

function successorAfter(state, playerId, count) {
  let result = playerId;
  for (let index = 0; index < count; index += 1) {
    result = getCounterclockwiseSuccessor(state.seating, result);
  }
  return result;
}

function ensureDominoesInHand(state, playerId, dominoIds) {
  const nextState = structuredClone(state);
  for (const dominoId of dominoIds) {
    if (nextState.hands[playerId].includes(dominoId)) {
      continue;
    }
    const currentOwnerId = findDominoOwner(nextState, dominoId);
    const replacementId = nextState.hands[playerId].find(
      (candidateId) =>
        candidateId !== STARTING_DOMINO_ID &&
        !dominoIds.includes(candidateId),
    );
    const desiredIndex = nextState.hands[currentOwnerId].indexOf(dominoId);
    const replacementIndex = nextState.hands[playerId].indexOf(replacementId);
    nextState.hands[currentOwnerId][desiredIndex] = replacementId;
    nextState.hands[playerId][replacementIndex] = dominoId;
  }
  return nextState;
}

function distributeExitHands(state, finishingPlayerId, dominoId) {
  const nextState = structuredClone(state);
  const placedIds = new Set(
    Object.values(nextState.board.placements).map(
      (placement) => placement.dominoId,
    ),
  );
  const remainingIds = Object.keys(nextState.dominoes).filter(
    (candidateId) => !placedIds.has(candidateId),
  );
  const startingPlayerId = nextState.history[0].playerId;
  const otherPlayerIds = nextState.seating.counterclockwisePlayerIds.filter(
    (playerId) => playerId !== finishingPlayerId,
  );
  const capacities = [7, 7, 6];
  const pool = remainingIds.filter(
    (candidateId) =>
      candidateId !== dominoId && candidateId !== STARTING_DOMINO_ID,
  );

  nextState.hands = Object.fromEntries(
    nextState.seating.counterclockwisePlayerIds.map((playerId) => [
      playerId,
      [],
    ]),
  );
  nextState.hands[finishingPlayerId] = [dominoId];
  for (let index = 0; index < otherPlayerIds.length; index += 1) {
    const playerId = otherPlayerIds[index];
    const hand = [];
    if (playerId === startingPlayerId) {
      hand.push(STARTING_DOMINO_ID);
    }
    while (hand.length < capacities[index]) {
      hand.push(pool.shift());
    }
    nextState.hands[playerId] = hand;
  }

  return nextState;
}

export function createBlockedTurnState() {
  const state = normalizeRegulatoryHistory(
    buildZeroEndedMainLine(CLOSED_ZERO_CHAIN),
  );
  const targets = getOpenEndTargets(state);
  if (!targets.every((target) => target.value === 0)) {
    throw new Error("El escenario de bloqueo debe terminar únicamente en 0.");
  }
  return validateRoundState(state);
}

export function createPassThenPlayState(passCount = 3) {
  let state = normalizeRegulatoryHistory(
    buildZeroEndedMainLine(RECOVERABLE_ZERO_CHAIN),
  );
  const recoveryPlayerId = successorAfter(
    state,
    state.currentPlayerId,
    passCount,
  );
  state = ensureDominoesInHand(state, recoveryPlayerId, ["0-5", "0-6"]);
  return validateRoundState(state);
}

export function createExitTurnState() {
  let state = normalizeRegulatoryHistory(
    buildZeroEndedMainLine(RECOVERABLE_ZERO_CHAIN),
  );
  state = distributeExitHands(state, state.currentPlayerId, "0-5");
  return validateRoundState(state);
}
