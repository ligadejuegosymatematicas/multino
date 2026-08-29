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

const MAIN_STRUCTURE = Object.freeze({
  id: "main",
  code: "P",
  label: "Principal",
});
const BRANCH_PORT_IDS = Object.freeze(["branch:1", "branch:2"]);

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

function getAlphabeticCode(index) {
  let code = "";
  let remainder = index;
  do {
    code = String.fromCharCode(65 + (remainder % 26)) + code;
    remainder = Math.floor(remainder / 26) - 1;
  } while (remainder >= 0);
  return code;
}

function createBranchStructures(state, occupiedBranches) {
  const occupiedById = new Map(
    occupiedBranches.map((branch) => [branch.id, branch]),
  );
  let branchIndex = 0;

  return state.board.specialDoublePlacementIds.flatMap(
    (originPlacementId) => BRANCH_PORT_IDS.map((originPortId) => {
      const id = `${originPlacementId}:${originPortId}`;
      const occupied = occupiedById.get(id) ?? null;
      const code = getAlphabeticCode(branchIndex);
      branchIndex += 1;
      return {
        id,
        code,
        label: `Rama ${code}`,
        originPlacementId,
        originPortId,
        isOccupied: occupied !== null,
        placementIds: occupied ? [...occupied.placementIds] : [],
      };
    }),
  );
}

function projectOpenTargetTopology(target, branchStructureById) {
  if (target.kind === "main") {
    return {
      targetId: target.id,
      placementId: target.placementId,
      portId: target.portId,
      region: "main",
      structureId: MAIN_STRUCTURE.id,
      structureCode: MAIN_STRUCTURE.code,
      structureLabel: MAIN_STRUCTURE.label,
      originPlacementId: null,
      originPortId: null,
    };
  }

  const origin = target.branchOrigin;
  const structureId = `${origin.placementId}:${origin.portId}`;
  const structure = branchStructureById.get(structureId);
  return {
    targetId: target.id,
    placementId: target.placementId,
    portId: target.portId,
    region: "branch",
    structureId,
    structureCode: structure.code,
    structureLabel: structure.label,
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
  const branchStructures = createBranchStructures(state, derivedBranches);
  const branchStructureById = new Map(
    branchStructures.map((branch) => [branch.id, branch]),
  );
  const branchStructuresByOrigin = new Map();
  for (const structure of branchStructures) {
    const structures = branchStructuresByOrigin.get(
      structure.originPlacementId,
    ) ?? [];
    structures.push(structure);
    branchStructuresByOrigin.set(structure.originPlacementId, structures);
  }
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
      const structure = branch
        ? branchStructureById.get(branch.structureId)
        : MAIN_STRUCTURE;
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
        structureId: structure.id,
        structureCode: structure.code,
        structureLabel: structure.label,
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
        branchStructures: (
          branchStructuresByOrigin.get(placementId) ?? []
        ).map((candidate) => ({
          id: candidate.id,
          code: candidate.code,
          label: candidate.label,
          originPortId: candidate.originPortId,
          isOccupied: candidate.isOccupied,
        })),
      };
    });

  const configuredK = state.config.specialMainLineDoublesLimit;
  const effectiveK = getEffectiveK(configuredK);
  const enabledCount = state.board.specialDoublePlacementIds.length;

  return {
    mainLine: {
      id: MAIN_STRUCTURE.id,
      code: MAIN_STRUCTURE.code,
      label: MAIN_STRUCTURE.label,
      placementIds: mainLinePlacementIds,
    },
    branches: branchStructures
      .filter((branch) => branch.isOccupied)
      .map((branch) => ({
        id: branch.id,
        code: branch.code,
        label: branch.label,
        originPlacementId: branch.originPlacementId,
        originPortId: branch.originPortId,
        placementIds: [...branch.placementIds],
      })),
    branchStructures: branchStructures.map((branch) => ({
      ...branch,
      placementIds: [...branch.placementIds],
    })),
    openTargets: getOpenEndTargets(state).map((target) =>
      projectOpenTargetTopology(target, branchStructureById)
    ),
    placements,
    specialDoubles: {
      configuredK,
      effectiveK,
      enabledCount,
      remainingCapacity: Math.max(effectiveK - enabledCount, 0),
    },
  };
}
