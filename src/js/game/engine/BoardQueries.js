import { domainAssert } from "../errors/DomainError.js";
import {
  getPlacementPort,
  getPrincipalPortIds,
} from "./BoardPorts.js";
import {
  createPortUsageIndex,
  deriveOccupiedBranches,
  getConnectionAtPort,
} from "./BoardTopology.js";
import { validateBoardState } from "./BoardValidator.js";

function createOpenEndTarget(
  state,
  placementId,
  portId,
  kind,
  extra = {},
) {
  const port = getPlacementPort(state, placementId, portId);
  return {
    id: `${placementId}:${portId}`,
    value: port.value,
    placementId,
    portId,
    kind,
    ...extra,
  };
}

function findFreePrincipalPortId(state, usage, placementId) {
  const freePortIds = getPrincipalPortIds(state, placementId).filter(
    (portId) => !getConnectionAtPort(state, usage, placementId, portId),
  );
  domainAssert(
    freePortIds.length === 1,
    "INVALID_MAIN_LINE_END",
    `La colocación principal ${placementId} debe tener un único puerto principal libre.`,
    { placementId, freePortIds },
  );
  return freePortIds[0];
}

/** DEC-016: devuelve ramas derivadas, nunca persistidas. */
export function getDerivedBranches(state) {
  validateBoardState(state);
  return deriveOccupiedBranches(state);
}

/** DEC-021/DEC-028: destinos abiertos con identidad individual. */
export function getOpenEndTargets(state) {
  validateBoardState(state);
  const mainLineIds = state.board.mainLine.placementIds;
  if (mainLineIds.length === 0) {
    return [];
  }

  const usage = createPortUsageIndex(state);
  const targets = [];

  if (mainLineIds.length === 1) {
    const placementId = mainLineIds[0];
    const principalPortIds = getPrincipalPortIds(state, placementId);
    targets.push(
      createOpenEndTarget(
        state,
        placementId,
        principalPortIds[0],
        "main",
        { mainLineEnd: "start" },
      ),
      createOpenEndTarget(
        state,
        placementId,
        principalPortIds[1],
        "main",
        { mainLineEnd: "end" },
      ),
    );
  } else {
    const startPlacementId = mainLineIds[0];
    const endPlacementId = mainLineIds.at(-1);
    targets.push(
      createOpenEndTarget(
        state,
        startPlacementId,
        findFreePrincipalPortId(state, usage, startPlacementId),
        "main",
        { mainLineEnd: "start" },
      ),
      createOpenEndTarget(
        state,
        endPlacementId,
        findFreePrincipalPortId(state, usage, endPlacementId),
        "main",
        { mainLineEnd: "end" },
      ),
    );
  }

  const occupiedBranches = deriveOccupiedBranches(state, usage);
  const branchesByOrigin = new Map(
    occupiedBranches.map((branch) => [branch.id, branch]),
  );

  for (const originPlacementId of state.board.specialDoublePlacementIds) {
    for (const originPortId of ["branch:1", "branch:2"]) {
      const branchId = `${originPlacementId}:${originPortId}`;
      const branch = branchesByOrigin.get(branchId);
      if (!branch) {
        targets.push(
          createOpenEndTarget(
            state,
            originPlacementId,
            originPortId,
            "branch-origin",
            {
              branchOrigin: {
                placementId: originPlacementId,
                portId: originPortId,
              },
            },
          ),
        );
        continue;
      }

      targets.push(
        createOpenEndTarget(
          state,
          branch.terminal.placementId,
          branch.terminal.portId,
          "branch",
          { branchOrigin: { ...branch.origin } },
        ),
      );
    }
  }

  return targets;
}
