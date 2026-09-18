import { getOpenEndTargets } from "../engine/BoardQueries.js";
import { getBranchingDoubleState } from "../engine/BranchingDoubleState.js";
import { validateBoardState } from "../engine/BoardValidator.js";
import { getRoundStructureMode } from "../setup/MatchConfig.js";

const VALUES = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

/** Consulta pública derivada; no persiste contadores ni duplica targets. */
export function getRoundStructureProjection(state) {
  validateBoardState(state);
  const openTargets = getOpenEndTargets(state);
  const playedDominoes = Object.values(state.board.placements).map(
    (placement) => state.dominoes[placement.dominoId],
  );
  const branchingPlacementId = state.board.specialDoublePlacementIds[0] ?? null;

  return {
    mode: getRoundStructureMode(state.config),
    values: VALUES.map((value) => ({
      value,
      playedTileCount: playedDominoes.filter((domino) =>
        domino.sides.some((side) => side.value === value)
      ).length,
      totalTileCount: 7,
      openTargetCount: openTargets.filter((target) => target.value === value).length,
    })),
    branchingDouble: branchingPlacementId === null
      ? null
      : (() => {
          const ramifier = getBranchingDoubleState(state);
          return {
            value: ramifier.value,
            placementId: ramifier.placementId,
            connectionCount: ramifier.connectionCount,
            capacity: ramifier.capacity,
            remainingConnections: ramifier.remainingConnections,
            phase: ramifier.phase,
            continuationPortsRemaining: ramifier.continuationPortsRemaining,
            lateralPortsUnlocked: ramifier.lateralPortsUnlocked,
            lateralPortsRemaining: ramifier.lateralPortsRemaining,
            contributesToScoring: ramifier.contributesToScoring,
            isSaturated: ramifier.isSaturated,
          };
        })(),
  };
}
