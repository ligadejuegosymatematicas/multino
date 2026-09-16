import { createMatch } from "../../src/js/game/setup/createMatch.js";
import { applyPlay } from "../../src/js/game/engine/PlayTransition.js";
import { getOpenEndTargets } from "../../src/js/game/engine/BoardQueries.js";
import { createValidParticipantInput } from "./participants.js";
import { ROUND_STRUCTURE_MODES } from "../../src/js/game/setup/MatchConfig.js";

export function findDominoOwner(state, dominoId) {
  return Object.entries(state.hands).find(([, hand]) =>
    hand.includes(dominoId),
  )?.[0];
}

export function ensureDominoInHand(state, playerId, dominoId) {
  if (state.hands[playerId].includes(dominoId)) {
    return state;
  }

  const nextState = structuredClone(state);
  const currentOwnerId = findDominoOwner(nextState, dominoId);
  const replacementId = nextState.hands[playerId].find(
    (candidateId) => candidateId !== "6-6",
  );
  const desiredIndex = nextState.hands[currentOwnerId].indexOf(dominoId);
  const replacementIndex = nextState.hands[playerId].indexOf(replacementId);
  nextState.hands[currentOwnerId][desiredIndex] = replacementId;
  nextState.hands[playerId][replacementIndex] = dominoId;
  return nextState;
}

export function createBoardScenario({
  mode,
  K,
  firstDominoId = "6-6",
} = {}) {
  const structuralMode = mode ?? (K === 0
    ? ROUND_STRUCTURE_MODES.LINEAR
    : ROUND_STRUCTURE_MODES.BRANCHED);
  let state = createMatch({
    ...createValidParticipantInput(),
    mode: structuralMode,
    randomSource: () => 0.25,
  });
  state = ensureDominoInHand(
    state,
    state.currentPlayerId,
    firstDominoId,
  );
  return state;
}

export function playDomino(state, dominoId, targetMatcher = null) {
  const playerId = findDominoOwner(state, dominoId);
  const boardIsEmpty = state.board.mainLine.placementIds.length === 0;
  let target = { kind: "START" };
  if (!boardIsEmpty) {
    const openTarget = getOpenEndTargets(state).find(targetMatcher);
    if (!openTarget) {
      throw new Error(`No se encontró destino para ${dominoId}.`);
    }
    target = {
      kind: "OPEN_END",
      placementId: openTarget.placementId,
      portId: openTarget.portId,
    };
  }

  return applyPlay(state, {
    type: "PLAY_DOMINO",
    playerId,
    dominoId,
    target,
  });
}
