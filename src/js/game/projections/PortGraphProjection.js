import { domainAssert } from "../errors/DomainError.js";
import {
  getPlacementPort,
  getPlacementPorts,
} from "../engine/BoardPorts.js";
import { getOpenEndTargets } from "../engine/BoardQueries.js";
import {
  createPortUsageIndex,
  getConnectionAtPort,
} from "../engine/BoardTopology.js";
import { validateBoardState } from "../engine/BoardValidator.js";
import { createDominoId, isDouble } from "../model/Domino.js";
import { projectRoundView } from "./RoundViewProjection.js";
import { getBoardTopologyProjection } from "./TopologyProjection.js";
import { getValueGraphProjection } from "./ValueGraphProjection.js";

const VALUES = Object.freeze([0, 1, 2, 3, 4, 5, 6]);

function macroNodeId(value) {
  return `B_${value}`;
}

function ordinaryPortId(value, otherValue) {
  return `p:${value}->${otherValue}`;
}

function doubleSocketId(placementId, portId) {
  return `socket:${placementId}:${portId}`;
}

function sideIdForValue(domino, value) {
  const matches = domino.sides.filter((side) => side.value === value);
  domainAssert(
    matches.length === 1,
    "INVALID_PORT_INCIDENCE",
    "Una ficha no doble debe tener una única cara para cada incidencia.",
    { dominoId: domino.id, value },
  );
  return `side:${matches[0].id}`;
}

function getOtherValue(domino, value) {
  const other = domino.sides.find((side) => side.value !== value);
  domainAssert(
    other !== undefined,
    "INVALID_PORT_INCIDENCE",
    "Una incidencia ordinaria requiere una ficha no doble.",
    { dominoId: domino.id, value },
  );
  return other.value;
}

function classifyConnection(firstTopology, secondTopology) {
  const branchTopology = firstTopology.region === "branch"
    ? firstTopology
    : secondTopology.region === "branch"
      ? secondTopology
      : null;
  if (branchTopology === null) {
    return {
      region: "main",
      structureId: "main",
      familyId: null,
      familyCode: null,
      familyIndex: null,
      armIndex: null,
      originPlacementId: null,
    };
  }
  return {
    region: "branch",
    structureId: branchTopology.structureId,
    familyId: branchTopology.familyId,
    familyCode: branchTopology.familyCode,
    familyIndex: branchTopology.familyIndex,
    armIndex: branchTopology.armIndex,
    originPlacementId: branchTopology.originPlacementId,
  };
}

function createEndpoint(state, endpoint) {
  const placement = state.board.placements[endpoint.placementId];
  const domino = state.dominoes[placement.dominoId];
  const boardPort = getPlacementPort(
    state,
    endpoint.placementId,
    endpoint.portId,
  );
  if (isDouble(domino)) {
    return {
      kind: "double-socket",
      id: doubleSocketId(endpoint.placementId, endpoint.portId),
      macroNodeId: macroNodeId(boardPort.value),
      value: boardPort.value,
      placementId: endpoint.placementId,
      dominoId: domino.id,
      boardPortId: endpoint.portId,
    };
  }
  const otherValue = getOtherValue(domino, boardPort.value);
  return {
    kind: "ordinary-port",
    id: ordinaryPortId(boardPort.value, otherValue),
    macroNodeId: macroNodeId(boardPort.value),
    value: boardPort.value,
    otherValue,
    placementId: endpoint.placementId,
    dominoId: domino.id,
    boardPortId: endpoint.portId,
  };
}

function createOpenTargetProjection(
  state,
  target,
  targetTopologyById,
) {
  const endpoint = createEndpoint(state, target);
  const topology = targetTopologyById.get(target.id);
  domainAssert(
    topology !== undefined,
    "MISSING_PORT_TARGET_TOPOLOGY",
    "No existe topología para un extremo abierto de Puertos.",
    { targetId: target.id },
  );
  return {
    ...structuredClone(target),
    actionTarget: {
      kind: "OPEN_END",
      placementId: target.placementId,
      portId: target.portId,
    },
    endpoint,
    topology: structuredClone(topology),
  };
}

/**
 * Grafo de incidencias sobre siete valores. No contiene geometría y nunca
 * reemplaza al tablero reglamentario como fuente de legalidad.
 */
export function getPortGraphProjection(state) {
  validateBoardState(state);
  const topology = getBoardTopologyProjection(state);
  const topologyByPlacementId = new Map(
    topology.placements.map((placement) => [placement.placementId, placement]),
  );
  const targetTopologyById = new Map(
    topology.openTargets.map((target) => [target.targetId, target]),
  );
  const historyByPlacementId = new Map(
    getValueGraphProjection(state).edges.map((edge) => [edge.placementId, edge]),
  );
  const placementByDominoId = new Map(
    Object.values(state.board.placements).map((placement) => [
      placement.dominoId,
      placement,
    ]),
  );
  const usage = createPortUsageIndex(state);
  const openTargets = getOpenEndTargets(state).map((target) =>
    createOpenTargetProjection(state, target, targetTopologyById)
  );
  const openTargetByEndpointId = new Map(
    openTargets.map((target) => [target.endpoint.id, target]),
  );

  const externalThreads = [];
  const doubleHubs = [];
  for (const placement of Object.values(state.board.placements)) {
    const domino = state.dominoes[placement.dominoId];
    const placementTopology = topologyByPlacementId.get(placement.id);
    domainAssert(
      placementTopology !== undefined,
      "MISSING_PORT_PLACEMENT_TOPOLOGY",
      "No existe topología para una colocación de Puertos.",
      { placementId: placement.id },
    );
    const temporal = historyByPlacementId.get(placement.id);
    if (!isDouble(domino)) {
      const [a, b] = domino.sides.map((side) => side.value);
      externalThreads.push({
        id: `thread:${placement.id}`,
        placementId: placement.id,
        dominoId: domino.id,
        a,
        b,
        fromPortId: ordinaryPortId(a, b),
        toPortId: ordinaryPortId(b, a),
        topology: structuredClone(placementTopology),
        playSequence: temporal.playSequence,
        turnNumber: temporal.turnNumber,
        playerId: temporal.playerId,
        teamId: temporal.teamId,
      });
      continue;
    }

    const value = domino.sides[0].value;
    doubleHubs.push({
      id: `double-hub:${placement.id}`,
      macroNodeId: macroNodeId(value),
      value,
      placementId: placement.id,
      dominoId: domino.id,
      isSpecial: placementTopology.isSpecialDouble,
      doubleRole: placementTopology.doubleRole,
      topology: structuredClone(placementTopology),
      playSequence: temporal.playSequence,
      turnNumber: temporal.turnNumber,
      playerId: temporal.playerId,
      teamId: temporal.teamId,
      sockets: getPlacementPorts(state, placement.id).map((port) => {
        const connection = getConnectionAtPort(
          state,
          usage,
          placement.id,
          port.id,
        );
        const id = doubleSocketId(placement.id, port.id);
        const openTarget = openTargetByEndpointId.get(id) ?? null;
        return {
          id,
          placementId: placement.id,
          boardPortId: port.id,
          value,
          role: port.role,
          connectionId: connection?.id ?? null,
          isOpenEnd: openTarget !== null,
          openTargetId: openTarget?.id ?? null,
        };
      }),
    });
  }

  const internalBridges = Object.values(state.board.connections).map(
    (connection) => {
      const first = createEndpoint(state, connection.from);
      const second = createEndpoint(state, connection.to);
      domainAssert(
        first.value === second.value,
        "INVALID_PORT_BRIDGE_VALUE",
        "Un puente interno debe enlazar incidencias del mismo valor.",
        { connectionId: connection.id, first, second },
      );
      const classification = classifyConnection(
        topologyByPlacementId.get(first.placementId),
        topologyByPlacementId.get(second.placementId),
      );
      return {
        id: `bridge:${connection.id}`,
        connectionId: connection.id,
        macroNodeId: macroNodeId(first.value),
        value: first.value,
        first,
        second,
        ...classification,
      };
    },
  );

  const bridgeIdsByValue = new Map(VALUES.map((value) => [value, []]));
  for (const bridge of internalBridges) {
    bridgeIdsByValue.get(bridge.value).push(bridge.id);
  }
  const threadIdsByPortId = new Map();
  for (const thread of externalThreads) {
    threadIdsByPortId.set(thread.fromPortId, thread.id);
    threadIdsByPortId.set(thread.toPortId, thread.id);
  }
  const hubIdsByValue = new Map(VALUES.map((value) => [value, []]));
  for (const hub of doubleHubs) {
    hubIdsByValue.get(hub.value).push(hub.id);
  }

  const macroNodes = VALUES.map((value) => ({
    id: macroNodeId(value),
    value,
    ordinaryPorts: VALUES
      .filter((otherValue) => otherValue !== value)
      .map((otherValue) => {
        const id = ordinaryPortId(value, otherValue);
        const dominoId = createDominoId(value, otherValue);
        const placement = placementByDominoId.get(dominoId) ?? null;
        const domino = state.dominoes[dominoId];
        const boardPortId = placement
          ? sideIdForValue(domino, value)
          : null;
        const portTopology = placement
          ? topologyByPlacementId.get(placement.id)
          : null;
        const connectionId = placement
          ? usage.get(`${placement.id}:${boardPortId}`) ?? null
          : null;
        const openTarget = openTargetByEndpointId.get(id) ?? null;
        return {
          id,
          value,
          otherValue,
          dominoId,
          state: placement ? "PLAYED" : "POTENTIAL",
          placementId: placement?.id ?? null,
          boardPortId,
          externalThreadId: threadIdsByPortId.get(id) ?? null,
          connectionId,
          isOpenEnd: openTarget !== null,
          openTargetId: openTarget?.id ?? null,
          topology: portTopology ? structuredClone(portTopology) : null,
        };
      }),
    internalBridgeIds: bridgeIdsByValue.get(value),
    doubleHubIds: hubIdsByValue.get(value),
  }));

  return {
    macroNodes,
    externalThreads,
    internalBridges,
    doubleHubs,
    openTargets,
    topology,
  };
}

/** Fachada compuesta y descartable para PortRenderer. */
export function projectPortView(state, playerId = state.currentPlayerId) {
  return {
    portGraph: getPortGraphProjection(state),
    ...projectRoundView(state, playerId),
  };
}
