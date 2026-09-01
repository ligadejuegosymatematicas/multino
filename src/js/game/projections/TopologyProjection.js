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

function createBranchFamilies(state, occupiedBranches) {
  const occupiedById = new Map(
    occupiedBranches.map((branch) => [branch.id, branch]),
  );

  return state.board.specialDoublePlacementIds.map(
    (originPlacementId, familyIndex) => {
      const code = getAlphabeticCode(familyIndex);
      return {
        id: `branch-family:${originPlacementId}`,
        code,
        label: `Ramificación ${code}`,
        familyIndex,
        originPlacementId,
        arms: BRANCH_PORT_IDS.map((originPortId, armIndex) => {
          const id = `${originPlacementId}:${originPortId}`;
          const occupied = occupiedById.get(id) ?? null;
          return {
            id,
            armIndex: armIndex + 1,
            originPortId,
            isOccupied: occupied !== null,
            placementIds: occupied ? [...occupied.placementIds] : [],
          };
        }),
      };
    },
  );
}

function projectOpenTargetTopology(target, branchArmById) {
  if (target.kind === "main") {
    return {
      targetId: target.id,
      placementId: target.placementId,
      portId: target.portId,
      region: "main",
      structureId: MAIN_STRUCTURE.id,
      structureCode: MAIN_STRUCTURE.code,
      structureLabel: MAIN_STRUCTURE.label,
      familyId: null,
      familyCode: null,
      familyLabel: null,
      familyIndex: null,
      armIndex: null,
      branchState: null,
      originPlacementId: null,
      originPortId: null,
    };
  }

  const origin = target.branchOrigin;
  const structureId = `${origin.placementId}:${origin.portId}`;
  const arm = branchArmById.get(structureId);
  return {
    targetId: target.id,
    placementId: target.placementId,
    portId: target.portId,
    region: "branch",
    structureId,
    structureCode: arm.familyCode,
    structureLabel: arm.familyLabel,
    familyId: arm.familyId,
    familyCode: arm.familyCode,
    familyLabel: arm.familyLabel,
    familyIndex: arm.familyIndex,
    armIndex: arm.armIndex,
    branchState: target.kind === "branch-origin" ? "POTENTIAL" : "STARTED",
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
  const branchFamilies = createBranchFamilies(state, derivedBranches);
  const branchFamilyByOrigin = new Map(
    branchFamilies.map((family) => [family.originPlacementId, family]),
  );
  const branchArmById = new Map();
  for (const family of branchFamilies) {
    for (const arm of family.arms) {
      branchArmById.set(arm.id, {
        ...arm,
        familyId: family.id,
        familyCode: family.code,
        familyLabel: family.label,
        familyIndex: family.familyIndex,
        originPlacementId: family.originPlacementId,
      });
    }
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
      const arm = branch ? branchArmById.get(branch.structureId) : null;
      const rootedFamily = branchFamilyByOrigin.get(placementId) ?? null;
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
        structureId: arm?.id ?? MAIN_STRUCTURE.id,
        structureCode: arm?.familyCode ?? MAIN_STRUCTURE.code,
        structureLabel: arm?.familyLabel ?? MAIN_STRUCTURE.label,
        familyId: arm?.familyId ?? null,
        familyCode: arm?.familyCode ?? null,
        familyLabel: arm?.familyLabel ?? null,
        familyIndex: arm?.familyIndex ?? null,
        armIndex: arm?.armIndex ?? null,
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
        branchFamily: rootedFamily
          ? {
              id: rootedFamily.id,
              code: rootedFamily.code,
              label: rootedFamily.label,
              familyIndex: rootedFamily.familyIndex,
              arms: rootedFamily.arms.map((candidate) => ({
                id: candidate.id,
                armIndex: candidate.armIndex,
                originPortId: candidate.originPortId,
                isOccupied: candidate.isOccupied,
              })),
            }
          : null,
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
    branches: branchFamilies.flatMap((family) =>
      family.arms
        .filter((arm) => arm.isOccupied)
        .map((arm) => ({
          id: arm.id,
          familyId: family.id,
          familyCode: family.code,
          familyLabel: family.label,
          familyIndex: family.familyIndex,
          armIndex: arm.armIndex,
          originPlacementId: family.originPlacementId,
          originPortId: arm.originPortId,
          placementIds: [...arm.placementIds],
        })),
    ),
    branchFamilies: branchFamilies.map((family) => ({
      ...family,
      arms: family.arms.map((arm) => ({
        ...arm,
        placementIds: [...arm.placementIds],
      })),
    })),
    openTargets: getOpenEndTargets(state).map((target) =>
      projectOpenTargetTopology(target, branchArmById)
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
