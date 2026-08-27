import { domainAssert } from "../errors/DomainError.js";
import { isDouble } from "../model/Domino.js";
import { getEffectiveK } from "../setup/MatchConfig.js";
import { ACTION_TYPES } from "./ActionTypes.js";
import { getOpenEndTargets } from "./BoardQueries.js";
import { validateBoardState } from "./BoardValidator.js";
import { getMatchingSideIds } from "./Compatibility.js";
import {
  getNextHistorySequence,
  getNextSequentialId,
} from "./SequentialIds.js";

export const BOARD_PLAY_READY = true;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getIncomingPortId(domino, targetValue, specialDouble) {
  if (specialDouble) {
    return "main:1";
  }

  const matchingSideIds = getMatchingSideIds(domino, targetValue);
  domainAssert(
    matchingSideIds.length > 0,
    "INCOMPATIBLE_PLAY",
    `La ficha ${domino.id} no es compatible con el valor ${targetValue}.`,
    { dominoId: domino.id, targetValue },
  );

  return isDouble(domino)
    ? "side:a"
    : `side:${matchingSideIds[0]}`;
}

function canonicalTarget(target) {
  if (target.kind === "START") {
    return { kind: "START" };
  }
  return {
    kind: "OPEN_END",
    placementId: target.placementId,
    portId: target.portId,
  };
}

/**
 * DEC-025: transición inmutable de tablero. No avanza turno ni puntuación.
 */
export function applyPlay(state, action) {
  validateBoardState(state);
  domainAssert(
    isRecord(action) && action.type === ACTION_TYPES.PLAY_DOMINO,
    "INVALID_PLAY_ACTION",
    "applyPlay requiere una acción PLAY_DOMINO.",
    { action },
  );
  domainAssert(
    typeof action.playerId === "string" && Array.isArray(state.hands[action.playerId]),
    "UNKNOWN_PLAYER_HAND",
    "La acción debe indicar un jugador con mano existente.",
    { playerId: action.playerId },
  );
  domainAssert(
    typeof action.dominoId === "string" && state.dominoes[action.dominoId],
    "UNKNOWN_PLAY_DOMINO",
    "La acción referencia una ficha inexistente.",
    { dominoId: action.dominoId },
  );
  const hand = state.hands[action.playerId];
  domainAssert(
    hand.includes(action.dominoId),
    "DOMINO_NOT_IN_HAND",
    `La ficha ${action.dominoId} no pertenece a ${action.playerId}.`,
    { playerId: action.playerId, dominoId: action.dominoId },
  );
  domainAssert(
    isRecord(action.target),
    "INVALID_PLAY_TARGET",
    "La acción debe contener un target discriminado.",
    { target: action.target },
  );

  const boardIsEmpty = state.board.mainLine.placementIds.length === 0;
  let selectedTarget = null;
  if (boardIsEmpty) {
    domainAssert(
      action.target.kind === "START",
      "FIRST_PLAY_REQUIRES_START",
      "La primera jugada debe usar target.kind=START.",
      { target: action.target },
    );
    domainAssert(
      action.playerId === state.currentPlayerId,
      "NOT_INITIAL_PLAYER",
      "Solo el jugador inicial puede colocar la primera ficha.",
      { playerId: action.playerId, currentPlayerId: state.currentPlayerId },
    );
  } else {
    domainAssert(
      action.target.kind === "OPEN_END" &&
        typeof action.target.placementId === "string" &&
        typeof action.target.portId === "string",
      "PLAY_REQUIRES_OPEN_END",
      "Una jugada posterior debe apuntar a placementId + portId.",
      { target: action.target },
    );
    selectedTarget = getOpenEndTargets(state).find(
      (target) =>
        target.placementId === action.target.placementId &&
        target.portId === action.target.portId,
    );
    domainAssert(
      selectedTarget,
      "INVALID_OPEN_END_TARGET",
      "El target no identifica un extremo abierto actual.",
      { target: action.target },
    );
  }

  const domino = state.dominoes[action.dominoId];
  const placementOnMainLine = boardIsEmpty || selectedTarget.kind === "main";
  const specialDouble =
    isDouble(domino) &&
    placementOnMainLine &&
    state.board.specialDoublePlacementIds.length <
      getEffectiveK(state.config.specialMainLineDoublesLimit);

  const placementId = getNextSequentialId(
    state.board.placements,
    "placement",
  );
  const connectionId = boardIsEmpty
    ? null
    : getNextSequentialId(state.board.connections, "connection");
  const incomingPortId = boardIsEmpty
    ? null
    : getIncomingPortId(domino, selectedTarget.value, specialDouble);

  const nextState = structuredClone(state);
  const dominoIndex = nextState.hands[action.playerId].indexOf(action.dominoId);
  nextState.hands[action.playerId].splice(dominoIndex, 1);
  nextState.board.placements[placementId] = {
    id: placementId,
    dominoId: action.dominoId,
  };

  if (placementOnMainLine) {
    if (boardIsEmpty) {
      nextState.board.mainLine.placementIds.push(placementId);
    } else if (selectedTarget.mainLineEnd === "start") {
      nextState.board.mainLine.placementIds.unshift(placementId);
    } else {
      nextState.board.mainLine.placementIds.push(placementId);
    }
  }
  if (specialDouble) {
    nextState.board.specialDoublePlacementIds.push(placementId);
  }

  if (!boardIsEmpty) {
    nextState.board.connections[connectionId] = {
      id: connectionId,
      from: {
        placementId: selectedTarget.placementId,
        portId: selectedTarget.portId,
      },
      to: {
        placementId,
        portId: incomingPortId,
      },
    };
  }

  nextState.history.push({
    sequence: getNextHistorySequence(state.history),
    turn: state.turnNumber,
    playerId: action.playerId,
    type: ACTION_TYPES.PLAY_DOMINO,
    payload: {
      dominoId: action.dominoId,
      target: canonicalTarget(action.target),
    },
    result: {
      placementId,
      connectionId,
    },
  });

  validateBoardState(nextState);
  return nextState;
}
