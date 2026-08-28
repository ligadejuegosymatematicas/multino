import { CAPABILITY_IMPLEMENTED } from "../../utils/constants.js";
import { domainAssert } from "../errors/DomainError.js";
import { getCounterclockwiseSuccessor } from "../setup/Seating.js";
import { ACTION_TYPES } from "./ActionTypes.js";
import { getLegalPlays } from "./LegalPlays.js";
import { applyPlay } from "./PlayTransition.js";
import {
  ROUND_END_REASONS,
  validateRoundState,
} from "./RoundValidator.js";
import { getNextHistorySequence } from "./SequentialIds.js";
import {
  calculateMoveScore,
  calculateOpenEndsSum,
} from "./Scoring.js";

export const TURN_CAPABILITIES = Object.freeze({
  initialPlayer: CAPABILITY_IMPLEMENTED,
  twoVsTwoOrder: CAPABILITY_IMPLEMENTED,
  turnTransition: CAPABILITY_IMPLEMENTED,
  passing: CAPABILITY_IMPLEMENTED,
  fourPassBlock: CAPABILITY_IMPLEMENTED,
});

export const TURN_MANAGER_READY = true;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function targetsMatch(first, second) {
  if (!isRecord(first) || !isRecord(second) || first.kind !== second.kind) {
    return false;
  }
  if (first.kind === "START") {
    return true;
  }
  return (
    first.kind === "OPEN_END" &&
    first.placementId === second.placementId &&
    first.portId === second.portId
  );
}

function getAvailableActionsFromValidState(state) {
  if (state.phase === "finished") {
    return [];
  }
  const plays = getLegalPlays(state, state.currentPlayerId);
  return plays.length > 0
    ? plays
    : [{ type: ACTION_TYPES.PASS, playerId: state.currentPlayerId }];
}

/** Consulta reglamentaria destinada a UI y simulaciones. */
export function getAvailableActions(state) {
  validateRoundState(state);
  return getAvailableActionsFromValidState(state);
}

function finishByEmptyHand(state, playerId) {
  const player = state.players[playerId];
  state.phase = "finished";
  state.roundResult = {
    reason: ROUND_END_REASONS.EMPTY_HAND,
    finishingPlayerId: playerId,
    finishingTeamId: player.teamId,
  };
}

function finishByBlock(state) {
  state.phase = "finished";
  state.roundResult = {
    reason: ROUND_END_REASONS.BLOCKED,
  };
}

function advanceTurn(state, playerId) {
  state.currentPlayerId = getCounterclockwiseSuccessor(
    state.seating,
    playerId,
  );
  state.turnNumber += 1;
}

function applyRegulatoryPlay(state, action, availableActions) {
  const legalAction = availableActions.find(
    (candidate) =>
      candidate.type === ACTION_TYPES.PLAY_DOMINO &&
      candidate.playerId === action.playerId &&
      candidate.dominoId === action.dominoId &&
      targetsMatch(candidate.target, action.target),
  );
  domainAssert(
    legalAction,
    "ILLEGAL_TURN_PLAY",
    "La jugada no pertenece al conjunto de jugadas legales actuales.",
    { action },
  );

  const nextState = applyPlay(state, legalAction);
  const openEndsSum = calculateOpenEndsSum(nextState);
  const scoreAwarded = calculateMoveScore(openEndsSum);
  const scoringTeamId = nextState.players[action.playerId].teamId;
  nextState.score.teams[scoringTeamId] += scoreAwarded;
  Object.assign(nextState.history.at(-1).result, {
    openEndsSum,
    scoreAwarded,
  });
  nextState.consecutivePasses = 0;
  if (nextState.hands[action.playerId].length === 0) {
    finishByEmptyHand(nextState, action.playerId);
  } else {
    advanceTurn(nextState, action.playerId);
  }
  return validateRoundState(nextState);
}

function applyRegulatoryPass(state, action, availableActions) {
  domainAssert(
    availableActions.length === 1 &&
      availableActions[0].type === ACTION_TYPES.PASS,
    "PASS_NOT_ALLOWED",
    "PASS solo es legal cuando el jugador actual no tiene jugadas legales.",
    { playerId: action.playerId },
  );

  const nextState = structuredClone(state);
  nextState.history.push({
    sequence: getNextHistorySequence(state.history),
    turn: state.turnNumber,
    playerId: action.playerId,
    type: ACTION_TYPES.PASS,
    payload: {},
    result: {},
  });
  nextState.consecutivePasses += 1;
  if (nextState.consecutivePasses === 4) {
    finishByBlock(nextState);
  } else {
    advanceTurn(nextState, action.playerId);
  }
  return validateRoundState(nextState);
}

/**
 * Transición reglamentaria: valida turno, compone la primitiva topológica y
 * coordina puntuación de jugada, pase, avance y terminación básica.
 */
export function applyTurnAction(state, action) {
  validateRoundState(state);
  domainAssert(
    state.phase === "playing",
    "ROUND_ALREADY_FINISHED",
    "No se aceptan acciones en una ronda terminada.",
    { phase: state.phase },
  );
  domainAssert(
    isRecord(action) &&
      [ACTION_TYPES.PLAY_DOMINO, ACTION_TYPES.PASS].includes(action.type),
    "UNSUPPORTED_TURN_ACTION",
    "La transición reglamentaria solo acepta PLAY_DOMINO o PASS.",
    { action },
  );
  domainAssert(
    action.playerId === state.currentPlayerId,
    "OUT_OF_TURN",
    "Solo currentPlayerId puede ejecutar la acción reglamentaria.",
    {
      playerId: action.playerId,
      currentPlayerId: state.currentPlayerId,
    },
  );

  const availableActions = getAvailableActionsFromValidState(state);
  return action.type === ACTION_TYPES.PLAY_DOMINO
    ? applyRegulatoryPlay(state, action, availableActions)
    : applyRegulatoryPass(state, action, availableActions);
}
