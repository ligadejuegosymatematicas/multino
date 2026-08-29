import { isDouble } from "../model/Domino.js";
import { getEffectiveK } from "../setup/MatchConfig.js";
import {
  createPortUsageIndex,
  deriveOccupiedBranches,
  getConnectionsForPlacement,
  getFreePortIds,
} from "../engine/BoardTopology.js";
import { getOpenEndTargets } from "../engine/BoardQueries.js";
import { validateBoardState } from "../engine/BoardValidator.js";
import { parseSequentialId } from "../engine/SequentialIds.js";

function comparePlacementIds(first, second) {
  return (
    parseSequentialId(first, "placement") -
    parseSequentialId(second, "placement")
  );
}

function getDoubleRole({ double, region, special }) {
  if (!double) {
    return null;
  }
  if (special) {
    return "SPECIAL_MAIN";
  }
  return region === "main"
    ? "ORDINARY_MAIN_K_EXHAUSTED"
    : "ORDINARY_BRANCH";
}

function projectOpenTargetTopology(target) {
  if (target.kind === "main") {
    return {
      targetId: target.id,
      placementId: target.placementId,
      portId: target.portId,
      region: "main",
      structureId: "main",
      originPlacementId: null,
      originPortId: null,
    };
  }

  const origin = target.branchOrigin;
  return {
    targetId: target.id,
    placementId: target.placementId,
    portId: target.portId,
    region: "branch",
    structureId: `${origin.placementId}:${origin.portId}`,
    originPlacementId: origin.placementId,
    originPortId: origin.portId,
  };
}

/**
 * Proyecta línea principal, ramas y capacidad de chanchos sin geometría ni
 * metadata persistida. `order` es uno-basado dentro de su estructura.
 */
export function getBoardTopologyProjection(state) {
  validateBoardState(state);

  const mainLinePlacementIds = [...state.board.mainLine.placementIds];
  const mainOrderByPlacementId = new Map(
    mainLinePlacementIds.map((placementId, index) => [placementId, index + 1]),
  );
  const specialPlacementIds = new Set(
    state.board.specialDoublePlacementIds,
  );
  const usage = createPortUsageIndex(state);
  const derivedBranches = deriveOccupiedBranches(state, usage);
  const branchByPlacementId = new Map();
  const startedBranchesByOrigin = new Map();

  for (const branch of derivedBranches) {
    startedBranchesByOrigin.set(
      branch.origin.placementId,
      (startedBranchesByOrigin.get(branch.origin.placementId) ?? 0) + 1,
    );
    branch.placementIds.forEach((placementId, index) => {
      branchByPlacementId.set(placementId, {
        structureId: branch.id,
        originPlacementId: branch.origin.placementId,
        originPortId: branch.origin.portId,
        depth: index + 1,
      });
    });
  }

  const placements = Object.keys(state.board.placements)
    .sort(comparePlacementIds)
    .map((placementId) => {
      const placement = state.board.placements[placementId];
      const domino = state.dominoes[placement.dominoId];
      const branch = branchByPlacementId.get(placementId) ?? null;
      const region = branch ? "branch" : "main";
      const double = isDouble(domino);
      const special = specialPlacementIds.has(placementId);
      const connectionCount = getConnectionsForPlacement(
        state,
        placementId,
      ).length;

      return {
        placementId,
        dominoId: placement.dominoId,
        region,
        structureId: branch?.structureId ?? "main",
        order: branch?.depth ?? mainOrderByPlacementId.get(placementId),
        originPlacementId: branch?.originPlacementId ?? null,
        originPortId: branch?.originPortId ?? null,
        depth: branch?.depth ?? null,
        isDouble: double,
        isSpecialDouble: special,
        isOrdinaryDoubleByKExhaustion:
          double && region === "main" && !special,
        isOrdinaryDoubleInBranch:
          double && region === "branch",
        doubleRole: getDoubleRole({ double, region, special }),
        connectionCount,
        connectionCapacity: special ? 4 : 2,
        freePortCount: getFreePortIds(
          state,
          usage,
          placementId,
        ).length,
        startedBranchCount:
          startedBranchesByOrigin.get(placementId) ?? 0,
      };
    });

  const configuredK = state.config.specialMainLineDoublesLimit;
  const effectiveK = getEffectiveK(configuredK);
  const enabledCount = state.board.specialDoublePlacementIds.length;

  return {
    mainLine: {
      placementIds: mainLinePlacementIds,
    },
    branches: derivedBranches.map((branch) => ({
      id: branch.id,
      originPlacementId: branch.origin.placementId,
      originPortId: branch.origin.portId,
      placementIds: [...branch.placementIds],
    })),
    openTargets: getOpenEndTargets(state).map(projectOpenTargetTopology),
    placements,
    specialDoubles: {
      configuredK,
      effectiveK,
      enabledCount,
      remainingCapacity: Math.max(effectiveK - enabledCount, 0),
    },
  };
}
