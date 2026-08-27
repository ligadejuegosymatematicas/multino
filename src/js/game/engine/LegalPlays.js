import { domainAssert } from "../errors/DomainError.js";
import { ACTION_TYPES } from "./ActionTypes.js";
import { getOpenEndTargets } from "./BoardQueries.js";
import { validateBoardState } from "./BoardValidator.js";
import { isDominoCompatibleWithValue } from "./Compatibility.js";

/** R-008/R-028/R-030: enumera ficha + destino, sin elegir por el jugador. */
export function getLegalPlays(state, playerId) {
  validateBoardState(state);
  const hand = state.hands[playerId];
  domainAssert(
    Array.isArray(hand),
    "UNKNOWN_PLAYER_HAND",
    `No existe una mano para el jugador ${String(playerId)}.`,
    { playerId },
  );

  if (state.board.mainLine.placementIds.length === 0) {
    if (playerId !== state.currentPlayerId) {
      return [];
    }
    return hand.map((dominoId) => ({
      type: ACTION_TYPES.PLAY_DOMINO,
      playerId,
      dominoId,
      target: { kind: "START" },
    }));
  }

  const targets = getOpenEndTargets(state);
  const plays = [];
  for (const dominoId of hand) {
    const domino = state.dominoes[dominoId];
    for (const target of targets) {
      if (!isDominoCompatibleWithValue(domino, target.value)) {
        continue;
      }
      plays.push({
        type: ACTION_TYPES.PLAY_DOMINO,
        playerId,
        dominoId,
        target: {
          kind: "OPEN_END",
          placementId: target.placementId,
          portId: target.portId,
        },
      });
    }
  }

  return plays;
}
