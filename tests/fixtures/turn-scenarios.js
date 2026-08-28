import { getOpenEndTargets } from "../../src/js/game/engine/BoardQueries.js";
import { validateRoundState } from "../../src/js/game/engine/RoundValidator.js";
import { applyTurnAction } from "../../src/js/game/engine/TurnManager.js";
import { createEmptyBoard } from "../../src/js/game/model/Board.js";
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
  const playerIds = state.seating.counterclockwisePlayerIds;
  const startingPlayerId = getStartingPlayerId(state);
  const startingIndex = playerIds.indexOf(startingPlayerId);
  const actions = state.history.map((entry, index) => ({
    type: entry.type,
    playerId: playerIds[(startingIndex + index) % playerIds.length],
    dominoId: entry.payload.dominoId,
    target: structuredClone(entry.payload.target),
  }));

  let replayState = structuredClone(state);
  replayState.board = createEmptyBoard();
  replayState.history = [];
  replayState.score.teams = Object.fromEntries(
    Object.keys(replayState.teams).map((teamId) => [teamId, 0]),
  );
  replayState.currentPlayerId = startingPlayerId;
  replayState.turnNumber = 1;
  replayState.consecutivePasses = 0;
  replayState.phase = "playing";
  delete replayState.roundResult;

  for (const action of actions) {
    replayState.hands[action.playerId].push(action.dominoId);
  }
  for (const action of actions) {
    replayState = applyTurnAction(replayState, action);
  }
  return replayState;
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

function distributeTeamDominoes(state, dominoIdsByTeam) {
  const nextState = structuredClone(state);
  nextState.hands = Object.fromEntries(
    Object.keys(nextState.players).map((playerId) => [playerId, []]),
  );
  const startingPlayerId = nextState.history[0].playerId;

  for (const [teamId, dominoIds] of Object.entries(dominoIdsByTeam)) {
    const playerIds = nextState.teams[teamId].playerIds;
    const startingTeamPlayerId = playerIds.includes(startingPlayerId)
      ? startingPlayerId
      : null;
    const otherPlayerId = playerIds.find(
      (playerId) => playerId !== startingTeamPlayerId,
    );
    const pool = dominoIds.filter(
      (dominoId) => dominoId !== STARTING_DOMINO_ID,
    );

    if (startingTeamPlayerId) {
      nextState.hands[startingTeamPlayerId].push(STARTING_DOMINO_ID);
      nextState.hands[otherPlayerId].push(pool.shift());
      for (const dominoId of pool) {
        const targetPlayerId =
          nextState.hands[startingTeamPlayerId].length <=
          nextState.hands[otherPlayerId].length
            ? startingTeamPlayerId
            : otherPlayerId;
        nextState.hands[targetPlayerId].push(dominoId);
      }
      continue;
    }

    nextState.hands[playerIds[0]].push(pool.shift());
    nextState.hands[playerIds[1]].push(pool.shift());
    for (const dominoId of pool) {
      const targetPlayerId =
        nextState.hands[playerIds[0]].length <=
        nextState.hands[playerIds[1]].length
          ? playerIds[0]
          : playerIds[1];
      nextState.hands[targetPlayerId].push(dominoId);
    }
  }
  return nextState;
}

function getRemainingDominoIds(state) {
  return Object.values(state.hands).flat();
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

export function createBlockedOutcomeState(outcome) {
  const state = createBlockedTurnState();
  const remainingIds = getRemainingDominoIds(state);
  let teamAIds;

  if (outcome === "A") {
    teamAIds = ["1-1", "2-2"];
  } else if (outcome === "B") {
    const teamBIds = [STARTING_DOMINO_ID, "1-1"];
    teamAIds = remainingIds.filter(
      (dominoId) => !teamBIds.includes(dominoId),
    );
  } else if (outcome === "TIE") {
    const equalTeamBIds = [
      STARTING_DOMINO_ID,
      "1-5",
      "1-3",
      "2-2",
      "2-6",
      "3-6",
      "5-5",
      "1-4",
      "2-3",
    ];
    teamAIds = remainingIds.filter(
      (dominoId) => !equalTeamBIds.includes(dominoId),
    );
  } else {
    throw new Error(`Resultado de tranque desconocido: ${outcome}`);
  }

  const teamBIds = remainingIds.filter(
    (dominoId) => !teamAIds.includes(dominoId),
  );
  return validateRoundState(
    distributeTeamDominoes(state, { A: teamAIds, B: teamBIds }),
  );
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

export function createExitTurnState(dominoId = "0-5") {
  let state = normalizeRegulatoryHistory(
    buildZeroEndedMainLine(RECOVERABLE_ZERO_CHAIN),
  );
  state = distributeExitHands(state, state.currentPlayerId, dominoId);
  return validateRoundState(state);
}
