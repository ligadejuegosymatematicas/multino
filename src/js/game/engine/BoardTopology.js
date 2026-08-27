import { domainAssert } from "../errors/DomainError.js";
import { getPlacementPorts } from "./BoardPorts.js";

export function getConnectionEndpoints(connection) {
  return [connection.from, connection.to];
}

export function getOtherEndpoint(connection, placementId) {
  if (connection.from.placementId === placementId) {
    return connection.to;
  }
  if (connection.to.placementId === placementId) {
    return connection.from;
  }
  return null;
}

export function getConnectionsForPlacement(state, placementId) {
  return Object.values(state.board.connections).filter(
    (connection) => getOtherEndpoint(connection, placementId) !== null,
  );
}

export function createPortUsageIndex(state) {
  const usage = new Map();
  for (const connection of Object.values(state.board.connections)) {
    for (const endpoint of getConnectionEndpoints(connection)) {
      usage.set(
        `${endpoint.placementId}:${endpoint.portId}`,
        connection.id,
      );
    }
  }
  return usage;
}

export function getConnectionAtPort(state, usage, placementId, portId) {
  const connectionId = usage.get(`${placementId}:${portId}`);
  return connectionId ? state.board.connections[connectionId] : null;
}

export function getFreePortIds(state, usage, placementId) {
  return getPlacementPorts(state, placementId)
    .filter((port) => !usage.has(`${placementId}:${port.id}`))
    .map((port) => port.id);
}

/**
 * DEC-016: deriva cadenas laterales desde sus puertos de origen.
 * Requiere un tablero previamente validado.
 */
export function deriveOccupiedBranches(state, usage = createPortUsageIndex(state)) {
  const mainSet = new Set(state.board.mainLine.placementIds);
  const branches = [];

  for (const originPlacementId of state.board.specialDoublePlacementIds) {
    for (const originPortId of ["branch:1", "branch:2"]) {
      const originConnection = getConnectionAtPort(
        state,
        usage,
        originPlacementId,
        originPortId,
      );
      if (!originConnection) {
        continue;
      }

      const firstEndpoint = getOtherEndpoint(
        originConnection,
        originPlacementId,
      );
      domainAssert(
        firstEndpoint && !mainSet.has(firstEndpoint.placementId),
        "INVALID_BRANCH_ORIGIN",
        "Un puerto branch:* ocupado debe conducir fuera de mainLine.",
        { originPlacementId, originPortId },
      );

      const placementIds = [];
      const connectionIds = [originConnection.id];
      const visited = new Set();
      let currentPlacementId = firstEndpoint.placementId;
      let previousConnectionId = originConnection.id;

      while (true) {
        domainAssert(
          !visited.has(currentPlacementId),
          "BRANCH_CYCLE",
          "Una ramificación no puede contener ciclos.",
          { originPlacementId, originPortId, currentPlacementId },
        );
        visited.add(currentPlacementId);
        placementIds.push(currentPlacementId);

        const continuations = getConnectionsForPlacement(
          state,
          currentPlacementId,
        ).filter((connection) => connection.id !== previousConnectionId);

        if (continuations.length === 0) {
          const freePortIds = getFreePortIds(
            state,
            usage,
            currentPlacementId,
          );
          domainAssert(
            freePortIds.length === 1,
            "INVALID_BRANCH_TERMINAL",
            "Una ramificación debe tener exactamente un puerto terminal libre.",
            { currentPlacementId, freePortIds },
          );
          branches.push({
            id: `${originPlacementId}:${originPortId}`,
            origin: {
              placementId: originPlacementId,
              portId: originPortId,
            },
            placementIds,
            connectionIds,
            terminal: {
              placementId: currentPlacementId,
              portId: freePortIds[0],
            },
          });
          break;
        }

        domainAssert(
          continuations.length === 1,
          "SECOND_LEVEL_BRANCH",
          "Una ramificación no puede bifurcarse.",
          { currentPlacementId },
        );
        const nextConnection = continuations[0];
        const nextEndpoint = getOtherEndpoint(
          nextConnection,
          currentPlacementId,
        );
        domainAssert(
          nextEndpoint && !mainSet.has(nextEndpoint.placementId),
          "BRANCH_RECONNECTS_MAIN_LINE",
          "Una ramificación no puede volver a mainLine.",
          { currentPlacementId, connectionId: nextConnection.id },
        );

        connectionIds.push(nextConnection.id);
        previousConnectionId = nextConnection.id;
        currentPlacementId = nextEndpoint.placementId;
      }
    }
  }

  return branches;
}
