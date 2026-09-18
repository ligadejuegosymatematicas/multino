import { domainAssert } from "../errors/DomainError.js";
import {
  SPECIAL_BRANCH_PORT_IDS,
  SPECIAL_MAIN_PORT_IDS,
} from "./BoardPorts.js";

export const BRANCHING_DOUBLE_PHASES = Object.freeze({
  TIP: "tip",
  CONTINUITY: "continuity",
  CROSS: "cross",
  LATERAL: "lateral",
  SATURATED: "saturated",
});

function connectionIdAtPort(state, placementId, portId) {
  return Object.values(state.board.connections).find((connection) =>
    [connection.from, connection.to].some((endpoint) =>
      endpoint.placementId === placementId && endpoint.portId === portId
    )
  )?.id ?? null;
}

function phaseForConnectionCount(connectionCount) {
  if (connectionCount === 0) return BRANCHING_DOUBLE_PHASES.TIP;
  if (connectionCount === 1) return BRANCHING_DOUBLE_PHASES.CONTINUITY;
  if (connectionCount === 2) return BRANCHING_DOUBLE_PHASES.CROSS;
  if (connectionCount === 3) return BRANCHING_DOUBLE_PHASES.LATERAL;
  return BRANCHING_DOUBLE_PHASES.SATURATED;
}

/**
 * Deriva el estado local del único chancho ramificador. No valida el snapshot
 * completo para poder reutilizarse desde el validador y las consultas.
 */
export function getBranchingDoubleState(state) {
  const placementId = state.board.specialDoublePlacementIds[0] ?? null;
  if (placementId === null) return null;

  const placement = state.board.placements[placementId];
  const domino = placement ? state.dominoes[placement.dominoId] : null;
  domainAssert(
    placement && domino,
    "INVALID_SPECIAL_DOUBLE",
    "El chancho ramificador debe referenciar una colocación y ficha existentes.",
    { placementId },
  );

  const continuationConnections = SPECIAL_MAIN_PORT_IDS.map((portId) => ({
    portId,
    connectionId: connectionIdAtPort(state, placementId, portId),
  }));
  const lateralConnections = SPECIAL_BRANCH_PORT_IDS.map((portId) => ({
    portId,
    connectionId: connectionIdAtPort(state, placementId, portId),
  }));
  const continuationPortIdsRemaining = continuationConnections
    .filter((entry) => entry.connectionId === null)
    .map((entry) => entry.portId);
  const lateralPortIdsRemaining = lateralConnections
    .filter((entry) => entry.connectionId === null)
    .map((entry) => entry.portId);
  const connectionCount =
    4 - continuationPortIdsRemaining.length - lateralPortIdsRemaining.length;
  const lateralPortsUnlocked = continuationPortIdsRemaining.length === 0;

  return {
    value: domino.sides[0].value,
    placementId,
    connectionCount,
    capacity: 4,
    remainingConnections: 4 - connectionCount,
    phase: phaseForConnectionCount(connectionCount),
    continuationPortsRemaining: continuationPortIdsRemaining.length,
    lateralPortsUnlocked,
    lateralPortsRemaining: lateralPortIdsRemaining.length,
    contributesToScoring: connectionCount <= 1,
    isSaturated: connectionCount === 4,
    availablePortIds: lateralPortsUnlocked
      ? lateralPortIdsRemaining
      : continuationPortIdsRemaining,
    continuationConnections,
    lateralConnections,
  };
}
