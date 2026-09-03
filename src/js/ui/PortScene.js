export const PORT_SCENE_LAYOUTS = Object.freeze({
  COMPACT: "compact",
  WIDE: "wide",
});

const GEOMETRY = Object.freeze({
  [PORT_SCENE_LAYOUTS.COMPACT]: Object.freeze({
    width: 720,
    height: 620,
    center: Object.freeze({ x: 360, y: 310 }),
    radii: Object.freeze({ x: 238, y: 232 }),
  }),
  [PORT_SCENE_LAYOUTS.WIDE]: Object.freeze({
    width: 920,
    height: 620,
    center: Object.freeze({ x: 460, y: 310 }),
    radii: Object.freeze({ x: 290, y: 238 }),
  }),
});
const NODE_RADIUS = 55;
const FULL_TURN = Math.PI * 2;

function round(value) {
  return Number(value.toFixed(2));
}

function pointAt(origin, angle, distance) {
  return {
    x: round(origin.x + Math.cos(angle) * distance),
    y: round(origin.y + Math.sin(angle) * distance),
  };
}

function nodePosition(value, geometry) {
  const angle = -Math.PI / 2 + (FULL_TURN * value) / 7;
  return {
    x: round(geometry.center.x + Math.cos(angle) * geometry.radii.x),
    y: round(geometry.center.y + Math.sin(angle) * geometry.radii.y),
    angle,
  };
}

function portPosition(node, otherNode) {
  const angle = Math.atan2(otherNode.y - node.y, otherNode.x - node.x);
  return { ...pointAt(node, angle, NODE_RADIUS - 1), angle };
}

function socketPosition(node, boardPortId, isSpecial) {
  const angleByPortId = isSpecial
    ? {
        "main:1": Math.PI,
        "main:2": 0,
        "branch:1": -Math.PI / 2,
        "branch:2": Math.PI / 2,
      }
    : {
        "side:a": Math.PI,
        "side:b": 0,
      };
  const angle = angleByPortId[boardPortId];
  return { ...pointAt(node, angle, isSpecial ? 23 : 18), angle };
}

function linePath(first, second, bend = 0) {
  if (bend === 0) {
    return `M ${first.x} ${first.y} L ${second.x} ${second.y}`;
  }
  const middle = {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const control = {
    x: round(middle.x - (dy / length) * bend),
    y: round(middle.y + (dx / length) * bend),
  };
  return `M ${first.x} ${first.y} Q ${control.x} ${control.y} ${second.x} ${second.y}`;
}

function targetIdentity(target) {
  return target.kind === "START" ? "START" : target.id;
}

function inspectionState(structureId, inspectedStructureId, rootPlacementId, placementId) {
  const active = inspectedStructureId !== null;
  const highlighted = active && structureId === inspectedStructureId;
  const root = active && rootPlacementId === placementId;
  return {
    isTopologyHighlighted: highlighted,
    isTopologyRoot: root,
    isTopologyDimmed: active && !highlighted && !root,
  };
}

function describeDoubleSocket(boardPortId) {
  const labels = {
    "main:1": "chancho · principal 1",
    "main:2": "chancho · principal 2",
    "branch:1": "chancho · lateral 1",
    "branch:2": "chancho · lateral 2",
    "side:a": "chancho · extremo 1",
    "side:b": "chancho · extremo 2",
  };
  return labels[boardPortId] ?? "chancho";
}

function createNodeInspector(node, bridges, hubs) {
  const playedPorts = node.ordinaryPorts.filter((port) => port.state === "PLAYED");
  return {
    value: node.value,
    playedPortCount: playedPorts.length,
    potentialPortCount: 6 - playedPorts.length,
    bridges: bridges.map((bridge) => ({
      connectionId: bridge.connectionId,
      firstLabel: bridge.first.kind === "ordinary-port"
        ? `${bridge.value}→${bridge.first.otherValue}`
        : describeDoubleSocket(bridge.first.boardPortId),
      secondLabel: bridge.second.kind === "ordinary-port"
        ? `${bridge.value}→${bridge.second.otherValue}`
        : describeDoubleSocket(bridge.second.boardPortId),
      region: bridge.region,
    })),
    hubs: hubs.map((hub) => ({
      dominoId: hub.dominoId,
      isSpecial: hub.isSpecial,
      usedSockets: hub.sockets.filter((socket) => socket.connectionId !== null).length,
      capacity: hub.sockets.length,
    })),
  };
}

/** Geometría descartable del grafo de incidencias. */
export function createPortScene(
  view,
  {
    selectedDominoId = null,
    legalTargets = [],
    inspectedStructureId = null,
    inspectedPlacementId = null,
    expandedNodeValue = null,
    layout = PORT_SCENE_LAYOUTS.COMPACT,
    scoringResolution = null,
  } = {},
) {
  const geometry = GEOMETRY[layout];
  if (!geometry) {
    throw new TypeError(`Layout de Puertos desconocido: ${layout}.`);
  }
  const nodePositions = new Map(
    view.portGraph.macroNodes.map((node) => [
      node.value,
      nodePosition(node.value, geometry),
    ]),
  );
  const endpointPositions = new Map();
  const nodes = view.portGraph.macroNodes.map((node) => {
    const position = nodePositions.get(node.value);
    const ordinaryPorts = node.ordinaryPorts.map((port) => {
      const projected = {
        ...port,
        ...portPosition(position, nodePositions.get(port.otherValue)),
      };
      endpointPositions.set(port.id, projected);
      return projected;
    });
    return { ...node, ...position, ordinaryPorts };
  });
  const hubs = view.portGraph.doubleHubs.map((hub) => {
    const node = nodePositions.get(hub.value);
    const hubCenter = { x: node.x, y: node.y + 14 };
    const sockets = hub.sockets.map((socket) => {
      const projected = {
        ...socket,
        ...socketPosition(hubCenter, socket.boardPortId, hub.isSpecial),
      };
      endpointPositions.set(socket.id, projected);
      return projected;
    });
    return { ...hub, ...hubCenter, sockets };
  });
  const hubByPlacementId = new Map(hubs.map((hub) => [hub.placementId, hub]));
  const familyById = new Map(
    view.portGraph.topology.branchFamilies.map((family) => [family.id, family]),
  );
  const legalTargetIds = new Set(legalTargets.map(targetIdentity));
  const hasSelection = selectedDominoId !== null;
  const compatibleCountsByValue = new Map();
  for (const target of view.portGraph.openTargets) {
    if (legalTargetIds.has(target.id)) {
      compatibleCountsByValue.set(
        target.value,
        (compatibleCountsByValue.get(target.value) ?? 0) + 1,
      );
    }
  }
  const compatibleIndexesByValue = new Map();
  const scoringEndpointIds = new Set();
  const scoringHubPlacementIds = new Set();
  for (const term of scoringResolution?.terms ?? []) {
    if (term.isDouble) {
      scoringHubPlacementIds.add(term.placementId);
      continue;
    }
    const target = view.portGraph.openTargets.find(
      (candidate) =>
        candidate.placementId === term.placementId &&
        candidate.portId === term.portId,
    );
    if (target) {
      scoringEndpointIds.add(target.endpoint.id);
    }
  }

  const threads = view.portGraph.externalThreads.map((thread) => {
    const structureId = thread.topology.familyId ?? "main";
    const family = thread.topology.familyId
      ? familyById.get(thread.topology.familyId)
      : null;
    return {
      ...thread,
      path: linePath(
        endpointPositions.get(thread.fromPortId),
        endpointPositions.get(thread.toPortId),
      ),
      familyTone: thread.topology.familyIndex === null
        ? null
        : thread.topology.familyIndex % 4,
      ...inspectionState(
        structureId,
        inspectedStructureId,
        family?.originPlacementId ?? null,
        thread.placementId,
      ),
    };
  });
  const bridgesByValue = new Map(nodes.map((node) => [node.value, []]));
  const bridges = view.portGraph.internalBridges.map((bridge, index) => {
    const family = bridge.familyId ? familyById.get(bridge.familyId) : null;
    const projected = {
      ...bridge,
      path: linePath(
        endpointPositions.get(bridge.first.id),
        endpointPositions.get(bridge.second.id),
        ((index % 3) - 1) * 7,
      ),
      familyTone: bridge.familyIndex === null
        ? null
        : bridge.familyIndex % 4,
      ...inspectionState(
        bridge.familyId ?? "main",
        inspectedStructureId,
        family?.originPlacementId ?? null,
        bridge.first.placementId,
      ),
    };
    bridgesByValue.get(bridge.value).push(projected);
    return projected;
  });
  const projectedHubs = hubs.map((hub) => {
    const family = hub.topology.branchFamily
      ? familyById.get(hub.topology.branchFamily.id)
      : null;
    const structureId = hub.topology.familyId ?? "main";
    return {
      ...hub,
      isScoringTerm: scoringHubPlacementIds.has(hub.placementId),
      ...inspectionState(
        structureId,
        inspectedStructureId,
        family?.originPlacementId ?? null,
        hub.placementId,
      ),
    };
  });
  const openTargets = view.portGraph.openTargets.map((target) => {
    const isLegal = hasSelection && legalTargetIds.has(target.id);
    const compatibleCount = compatibleCountsByValue.get(target.value) ?? 0;
    let optionIndex = null;
    if (isLegal && compatibleCount > 1) {
      const nextIndex = (compatibleIndexesByValue.get(target.value) ?? 0) + 1;
      compatibleIndexesByValue.set(target.value, nextIndex);
      optionIndex = nextIndex;
    }
    const family = target.topology.familyId
      ? familyById.get(target.topology.familyId)
      : null;
    return {
      ...target,
      ...endpointPositions.get(target.endpoint.id),
      isLegal,
      isIncompatible: hasSelection && !isLegal,
      optionIndex,
      compatibleCount,
      familyTone: target.topology.familyIndex === null
        ? null
        : target.topology.familyIndex % 4,
      isScoringTerm: scoringEndpointIds.has(target.endpoint.id),
      ...inspectionState(
        target.topology.familyId ?? "main",
        inspectedStructureId,
        family?.originPlacementId ?? null,
        target.placementId,
      ),
    };
  });

  const expandedNode = expandedNodeValue === null
    ? null
    : nodes.find((node) => node.value === expandedNodeValue) ?? null;
  const nodeInspector = expandedNode
    ? createNodeInspector(
        expandedNode,
        bridgesByValue.get(expandedNode.value),
        projectedHubs.filter((hub) => hub.value === expandedNode.value),
      )
    : null;

  return {
    viewBox: `0 0 ${geometry.width} ${geometry.height}`,
    width: geometry.width,
    height: geometry.height,
    orbit: {
      cx: geometry.center.x,
      cy: geometry.center.y,
      rx: geometry.radii.x,
      ry: geometry.radii.y,
    },
    hasSelection,
    selectedDominoId,
    inspectedStructureId,
    inspectedPlacementId,
    expandedNodeValue,
    nodeInspector,
    canStart: hasSelection && legalTargetIds.has("START"),
    nodes,
    threads,
    bridges,
    hubs: projectedHubs,
    openTargets,
  };
}
