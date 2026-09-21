import { getOpenEndTargets } from "../engine/BoardQueries.js";
import { getBranchingDoubleState } from "../engine/BranchingDoubleState.js";
import {
  applyTurnAction,
  getAvailableActions,
} from "../engine/TurnManager.js";

function actionKey(action) {
  if (action.type === "PASS") return `PASS:${action.playerId}`;
  const target = action.target.kind === "START"
    ? "START"
    : `${action.target.placementId}:${action.target.portId}`;
  return `${action.dominoId}:${target}`;
}

function publicRoundState(state) {
  return {
    phase: state.phase,
    turnNumber: state.turnNumber,
    currentPlayerId: state.currentPlayerId,
    consecutivePasses: state.consecutivePasses,
    scoreByTeam: structuredClone(state.score.teams),
    remainingDominoCountByPlayer: Object.fromEntries(
      Object.entries(state.hands).map(([playerId, hand]) => [playerId, hand.length]),
    ),
    playedDominoIds: Object.values(state.board.placements).map(
      (placement) => placement.dominoId,
    ),
    openTargetCountByValue: getOpenEndTargets(state).reduce((counts, target) => {
      counts[target.value] = (counts[target.value] ?? 0) + 1;
      return counts;
    }, Object.fromEntries(Array.from({ length: 7 }, (_, value) => [value, 0]))),
    branchingDouble: getBranchingDoubleState(state),
  };
}

function evaluatePlay(state, action, ownHand) {
  const nextState = applyTurnAction(state, action);
  const result = nextState.history.at(-1).result;
  const remainingOwnIds = ownHand.filter((dominoId) => dominoId !== action.dominoId);
  const remainingValues = new Set(remainingOwnIds.flatMap(
    (dominoId) => state.dominoes[dominoId].sides.map((side) => side.value),
  ));
  const openTargets = getOpenEndTargets(nextState);
  const ownFollowUpTargetCount = openTargets.filter(
    (target) => remainingValues.has(target.value),
  ).length;
  const domino = state.dominoes[action.dominoId];
  const isDouble = domino.sides[0].value === domino.sides[1].value;
  const beforeBranching = getBranchingDoubleState(state);
  const afterBranching = getBranchingDoubleState(nextState);
  return {
    scoreAwarded: result.scoreAwarded ?? 0,
    openTargetCount: openTargets.length,
    ownFollowUpTargetCount,
    isDouble,
    createsRamifier: beforeBranching === null && afterBranching !== null,
    completesContinuity:
      beforeBranching?.connectionCount === 1 &&
      afterBranching?.connectionCount === 2,
  };
}

/**
 * Frontera de privacidad de CPU: la salida contiene solo su mano y estado
 * público. Las manos rivales jamás forman parte del objeto consumido por IA.
 */
export function createCpuSeatView(state, playerId = state.currentPlayerId) {
  if (playerId !== state.currentPlayerId) {
    throw new Error("La CPU solo puede decidir para el asiento en turno.");
  }
  const ownHand = [...state.hands[playerId]];
  const legalActions = getAvailableActions(state).map((action) => ({
    ...structuredClone(action),
    key: actionKey(action),
    evaluation: action.type === "PLAY_DOMINO"
      ? evaluatePlay(state, action, ownHand)
      : null,
  }));
  return {
    seatId: playerId,
    ownHand,
    ownDominoes: Object.fromEntries(
      ownHand.map((dominoId) => [dominoId, structuredClone(state.dominoes[dominoId])]),
    ),
    publicState: publicRoundState(state),
    legalActions,
  };
}

function actionUtility(action) {
  if (action.type === "PASS") return Number.NEGATIVE_INFINITY;
  const evaluation = action.evaluation;
  return (
    evaluation.scoreAwarded * 10000 +
    evaluation.ownFollowUpTargetCount * 40 +
    evaluation.openTargetCount * 5 +
    (evaluation.completesContinuity ? 18 : 0) +
    (evaluation.createsRamifier ? 8 : 0) +
    (evaluation.isDouble ? 2 : 0)
  );
}

export function chooseCpuAction(stateForSeat) {
  if (!stateForSeat || !Array.isArray(stateForSeat.legalActions)) {
    throw new TypeError("stateForSeat debe contener legalActions.");
  }
  if (stateForSeat.legalActions.length === 0) {
    throw new Error("La CPU no recibió ninguna acción legal.");
  }
  const ordered = [...stateForSeat.legalActions].sort((first, second) =>
    actionUtility(second) - actionUtility(first) ||
    first.key.localeCompare(second.key)
  );
  const chosen = ordered[0];
  const { key: _key, evaluation: _evaluation, ...action } = chosen;
  return structuredClone(action);
}
