import { domainAssert } from "../errors/DomainError.js";
import {
  getPlacementPort,
  getPrincipalPortIds,
} from "../engine/BoardPorts.js";
import { getOpenEndTargets } from "../engine/BoardQueries.js";
import {
  createPortUsageIndex,
  deriveOccupiedBranches,
  getConnectionAtPort,
  getConnectionsForPlacement,
  getOtherEndpoint,
} from "../engine/BoardTopology.js";
import { validateBoardState } from "../engine/BoardValidator.js";
import { projectRoundView } from "./RoundViewProjection.js";
import { getBoardTopologyProjection } from "./TopologyProjection.js";

function findConnectionBetween(state, firstPlacementId, secondPlacementId) {
  const matches = getConnectionsForPlacement(state, firstPlacementId).filter(
    (connection) =>
      getOtherEndpoint(connection, firstPlacementId)?.placementId ===
      secondPlacementId,
  );
  domainAssert(
    matches.length === 1,
    "INVALID_TRADITIONAL_CHAIN_LINK",
    "Cada par consecutivo debe estar unido por una conexión exacta.",
    { firstPlacementId, secondPlacementId, connectionIds: matches.map(({ id }) => id) },
  );
  return matches[0];
}

function portIdAtPlacement(connection, placementId) {
  if (connection.from.placementId === placementId) {
    return connection.from.portId;
  }
  domainAssert(
    connection.to.placementId === placementId,
    "INVALID_TRADITIONAL_CONNECTION_ENDPOINT",
    "La conexión no contiene la colocación proyectada.",
    { connectionId: connection.id, placementId },
  );
  return connection.to.portId;
}

function createVisualPort(state, placementId, portId, connection = null) {
  const port = getPlacementPort(state, placementId, portId);
  const otherEndpoint = connection
    ? getOtherEndpoint(connection, placementId)
    : null;
  return {
    portId,
    value: port.value,
    connectionId: connection?.id ?? null,
    neighborPlacementId: otherEndpoint?.placementId ?? null,
  };
}

function createTileProjection(
  state,
  topologyByPlacementId,
  placementId,
  startPortId,
  endPortId,
  startConnection,
  endConnection,
) {
  const placement = state.board.placements[placementId];
  const domino = state.dominoes[placement.dominoId];
  const topology = topologyByPlacementId.get(placementId);
  domainAssert(
    topology !== undefined,
    "MISSING_TRADITIONAL_TOPOLOGY",
    `No existe topología proyectada para ${placementId}.`,
    { placementId },
  );
  return {
    placementId,
    dominoId: placement.dominoId,
    values: domino.sides.map((side) => side.value),
    isDouble: topology.isDouble,
    isSpecialDouble: topology.isSpecialDouble,
    doubleRole: topology.doubleRole,
    region: topology.region,
    order: topology.order,
    depth: topology.depth,
    familyId: topology.familyId,
    familyCode: topology.familyCode,
    familyIndex: topology.familyIndex,
    armIndex: topology.armIndex,
    originPlacementId: topology.originPlacementId,
    originPortId: topology.originPortId,
    start: createVisualPort(
      state,
      placementId,
      startPortId,
      startConnection,
    ),
    end: createVisualPort(
      state,
      placementId,
      endPortId,
      endConnection,
    ),
  };
}

function projectMainLine(state, topologyByPlacementId, usage) {
  const placementIds = [...state.board.mainLine.placementIds];
  const links = placementIds.slice(0, -1).map((placementId, index) =>
    findConnectionBetween(state, placementId, placementIds[index + 1])
  );
  const tiles = placementIds.map((placementId, index) => {
    const previousConnection = index === 0 ? null : links[index - 1];
    const nextConnection = index === placementIds.length - 1
      ? null
      : links[index];
    const principalPortIds = getPrincipalPortIds(state, placementId);
    const startPortId = previousConnection
      ? portIdAtPlacement(previousConnection, placementId)
      : principalPortIds.find(
          (portId) => !getConnectionAtPort(state, usage, placementId, portId),
        );
    const endPortId = nextConnection
      ? portIdAtPlacement(nextConnection, placementId)
      : principalPortIds.find(
          (portId) =>
            portId !== startPortId &&
            !getConnectionAtPort(state, usage, placementId, portId),
        );

    if (placementIds.length === 1) {
      return createTileProjection(
        state,
        topologyByPlacementId,
        placementId,
        principalPortIds[0],
        principalPortIds[1],
        null,
        null,
      );
    }

    domainAssert(
      startPortId && endPortId,
      "INVALID_TRADITIONAL_MAIN_PORTS",
      "No se pudieron orientar los puertos de la línea principal.",
      { placementId, startPortId, endPortId },
    );
    return createTileProjection(
      state,
      topologyByPlacementId,
      placementId,
      startPortId,
      endPortId,
      previousConnection,
      nextConnection,
    );
  });

  return {
    placementIds,
    connectionIds: links.map(({ id }) => id),
    tiles,
  };
}

function projectBranchArm(
  state,
  topologyByPlacementId,
  family,
  arm,
  occupiedById,
  openTargetByBranchId,
) {
  const occupied = occupiedById.get(arm.id) ?? null;
  const placementIds = occupied ? [...occupied.placementIds] : [];
  const connectionIds = occupied ? [...occupied.connectionIds] : [];
  const originConnection = occupied
    ? state.board.connections[connectionIds[0]]
    : null;
  const tiles = placementIds.map((placementId, index) => {
    const startConnection = state.board.connections[connectionIds[index]];
    const endConnectionId = connectionIds[index + 1] ?? null;
    const endConnection = endConnectionId
      ? state.board.connections[endConnectionId]
      : null;
    const startPortId = portIdAtPlacement(startConnection, placementId);
    const endPortId = endConnection
      ? portIdAtPlacement(endConnection, placementId)
      : occupied.terminal.portId;
    return createTileProjection(
      state,
      topologyByPlacementId,
      placementId,
      startPortId,
      endPortId,
      startConnection,
      endConnection,
    );
  });

  return {
    id: arm.id,
    familyId: family.id,
    familyCode: family.code,
    armIndex: arm.armIndex,
    originPlacementId: family.originPlacementId,
    originPortId: arm.originPortId,
    origin: createVisualPort(
      state,
      family.originPlacementId,
      arm.originPortId,
      originConnection,
    ),
    isStarted: occupied !== null,
    placementIds,
    connectionIds,
    tiles,
    openTarget: openTargetByBranchId.get(arm.id) ?? null,
  };
}

/**
 * Reconstrucción topológica tradicional sin coordenadas. La línea está ordenada
 * de `mainLine.start` a `mainLine.end`; cada brazo, de su raíz al extremo libre.
 */
export function getTraditionalBoardProjection(state) {
  validateBoardState(state);
  const topology = getBoardTopologyProjection(state);
  const topologyByPlacementId = new Map(
    topology.placements.map((placement) => [placement.placementId, placement]),
  );
  const usage = createPortUsageIndex(state);
  const occupiedBranches = deriveOccupiedBranches(state, usage);
  const occupiedById = new Map(
    occupiedBranches.map((branch) => [branch.id, branch]),
  );
  const targetTopologyById = new Map(
    topology.openTargets.map((target) => [target.targetId, target]),
  );
  const openTargets = getOpenEndTargets(state).map((target) => ({
    ...target,
    topology: { ...targetTopologyById.get(target.id) },
  }));
  const openTargetByBranchId = new Map(
    openTargets
      .filter((target) => target.branchOrigin)
      .map((target) => [
        `${target.branchOrigin.placementId}:${target.branchOrigin.portId}`,
        target,
      ]),
  );

  return {
    mainLine: projectMainLine(state, topologyByPlacementId, usage),
    branchFamilies: topology.branchFamilies.map((family) => {
      const root = topologyByPlacementId.get(family.originPlacementId);
      return {
        id: family.id,
        code: family.code,
        label: family.label,
        familyIndex: family.familyIndex,
        rootPlacementId: family.originPlacementId,
        rootMainOrder: root.order,
        arms: family.arms.map((arm) =>
          projectBranchArm(
            state,
            topologyByPlacementId,
            family,
            arm,
            occupiedById,
            openTargetByBranchId,
          )
        ),
      };
    }),
    openTargets,
    specialDoubles: { ...topology.specialDoubles },
  };
}

/** Fachada compuesta para TraditionalRenderer. */
export function projectTraditionalView(state, playerId = state.currentPlayerId) {
  return {
    table: getTraditionalBoardProjection(state),
    topology: getBoardTopologyProjection(state),
    ...projectRoundView(state, playerId),
  };
}
