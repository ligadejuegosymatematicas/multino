import { validateBoardState } from "../engine/BoardValidator.js";

/** Resume el último evento ya ocurrido; no anticipa acciones ni puntuación. */
export function getLatestActionProjection(state) {
  validateBoardState(state);
  const entry = state.history.at(-1);
  if (!entry) {
    return null;
  }

  const projection = {
    sequence: entry.sequence,
    turnNumber: entry.turn,
    playerId: entry.playerId,
    teamId: state.players[entry.playerId].teamId,
    type: entry.type,
    endedRound: state.phase === "finished",
  };

  if (entry.type === "PLAY_DOMINO") {
    Object.assign(projection, {
      dominoId: entry.payload.dominoId,
      placementId: entry.result.placementId,
    });
    if (
      Number.isSafeInteger(entry.result.openEndsSum) &&
      Number.isSafeInteger(entry.result.scoreAwarded)
    ) {
      Object.assign(projection, {
        openEndsSum: entry.result.openEndsSum,
        scoreAwarded: entry.result.scoreAwarded,
      });
    }
  }

  return projection;
}
