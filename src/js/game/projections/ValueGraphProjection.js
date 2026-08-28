import { validateBoardState } from "../engine/BoardValidator.js";
import { parseSequentialId } from "../engine/SequentialIds.js";

const VALUES = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

function comparePlacementIds(first, second) {
  return (
    parseSequentialId(first, "placement") -
    parseSequentialId(second, "placement")
  );
}

/** Proyecta el subgrafo de valores jugado, sin topología ni geometría visual. */
export function getValueGraphProjection(state) {
  validateBoardState(state);
  const historyByPlacementId = new Map(
    state.history
      .filter((entry) => entry.type === "PLAY_DOMINO")
      .map((entry) => [entry.result.placementId, entry]),
  );
  const incidentPlacementIdsByValue = new Map(
    VALUES.map((value) => [value, []]),
  );

  const edges = Object.keys(state.board.placements)
    .sort(comparePlacementIds)
    .map((placementId) => {
      const placement = state.board.placements[placementId];
      const domino = state.dominoes[placement.dominoId];
      const [a, b] = domino.sides.map((side) => side.value);
      const historyEntry = historyByPlacementId.get(placementId);
      incidentPlacementIdsByValue.get(a).push(placementId);
      if (b !== a) {
        incidentPlacementIdsByValue.get(b).push(placementId);
      }
      const playerId = historyEntry.playerId;
      return {
        dominoId: domino.id,
        placementId,
        a,
        b,
        isLoop: a === b,
        playSequence: historyEntry.sequence,
        turnNumber: historyEntry.turn,
        playerId,
        teamId: state.players[playerId].teamId,
      };
    });

  return {
    vertices: VALUES.map((value) => ({
      value,
      incidentPlacementIds: incidentPlacementIdsByValue.get(value),
    })),
    edges,
  };
}
