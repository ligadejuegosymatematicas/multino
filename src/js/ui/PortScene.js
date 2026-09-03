export const PORT_SCENE_LAYOUTS = Object.freeze({
  COMPACT: "compact",
  WIDE: "wide",
});

const GEOMETRY = Object.freeze({
  [PORT_SCENE_LAYOUTS.COMPACT]: Object.freeze({
    width: 720,
    height: 650,
    center: Object.freeze({ x: 360, y: 325 }),
    radii: Object.freeze({ x: 238, y: 230 }),
    focusRadius: 190,
  }),
  [PORT_SCENE_LAYOUTS.WIDE]: Object.freeze({
    width: 1040,
    height: 650,
    center: Object.freeze({ x: 520, y: 325 }),
    radii: Object.freeze({ x: 334, y: 258 }),
    focusRadius: 190,
  }),
});
const NODE_RADIUS = 62;
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

function ellipsePoint(center, radii, angle, factor = 1) {
  return {
    x: round(center.x + Math.cos(angle) * radii.x * factor),
    y: round(center.y + Math.sin(angle) * radii.y * factor),
  };
}

function nodePosition(value, geometry) {
  const angle = -Math.PI / 2 + (FULL_TURN * value) / 7;
  return {
    ...ellipsePoint(geometry.center, geometry.radii, angle),
    angle,
  };
}

function portPosition(node, otherNode) {
  const angle = Math.atan2(otherNode.y - node.y, otherNode.x - node.x);
  return { ...pointAt(node, angle, NODE_RADIUS - 2), angle };
}

function socketPosition(node, boardPortId, isSpecial, distance = null) {
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
  return {
    ...pointAt(node, angle, distance ?? (isSpecial ? 27 : 21)),
    angle,
  };
}

function quadraticPath(first, control, second) {
  return `M ${first.x} ${first.y} Q ${control.x} ${control.y} ${second.x} ${second.y}`;
}

function internalPath(first, second, bend = 0) {
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
  return {
    path: quadraticPath(first, control, second),
    route: { start: first, control, end: second },
  };
}

/** Enrutado anular determinista y descartable. */
function threadRoute(thread, first, second, nodePositions, geometry) {
  const clockwiseSteps = (thread.b - thread.a + 7) % 7;
  const direction = clockwiseSteps <= 3 ? 1 : -1;
  const steps = Math.min(clockwiseSteps, 7 - clockwiseSteps);
  const firstAngle = nodePositions.get(thread.a).angle;
  const middleAngle = firstAngle + direction * (steps * FULL_TURN / 7) / 2;
  const baseFactor = ({ 1: 0.9, 2: 0.93, 3: 0.97 })[steps] ?? 0.92;
  const branchOffset = thread.topology.region === "branch" ? 0.13 : 0;
  const familyOffset = thread.topology.familyIndex === null
    ? 0
    : (thread.topology.familyIndex % 3) * 0.025;
  const factor = Math.min(baseFactor + branchOffset + familyOffset, 1.14);
  const control = ellipsePoint(
    geometry.center,
    geometry.radii,
    middleAngle,
    factor,
  );
  return {
    path: quadraticPath(first, control, second),
    route: { start: first, control, end: second },
    lane: thread.topology.region === "branch" ? "outer" : "inner",
  };
}

function targetIdentity(target) {
  return target.kind === "START" ? "START" : target.id;
}

function inspectionState({
  structureId,
  familyId,
  rootPlacementId,
  placementId,
  inspectedStructureId,
  inspectedRouteId,
}) {
  const routeActive = inspectedRouteId !== null;
  const familyActive = !routeActive && inspectedStructureId !== null;
  const highlighted = routeActive
    ? structureId === inspectedRouteId
    : inspectedStructureId === "main"
      ? structureId === "main"
      : familyId === inspectedStructureId;
  const root = (routeActive || familyActive) &&
    rootPlacementId !== null &&
    rootPlacementId === placementId;
  return {
    isTopologyHighlighted: (routeActive || familyActive) && highlighted,
    isTopologyRoot: root,
    isTopologyDimmed: (routeActive || familyActive) && !highlighted && !root,
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

function focusPortPosition(center, index, radius) {
  const angle = -Math.PI / 2 + (FULL_TURN * index) / 6;
  return {
    ...pointAt(center, angle, radius),
    label: pointAt(center, angle, radius + 22),
    angle,
  };
}

function createNodeFocus({
  node,
  bridges,
  hubs,
  openTargets,
  geometry,
}) {
  if (!node) {
    return null;
  }
  const center = { ...geometry.center };
  const radius = geometry.focusRadius;
  const endpointPositions = new Map();
  const ports = node.ordinaryPorts.map((port, index) => {
    const position = focusPortPosition(center, index, radius - 28);
    const projected = { ...port, ...position };
    endpointPositions.set(port.id, projected);
    return projected;
  });
  const focusedHubs = hubs.map((hub) => {
    const hubCenter = { x: center.x, y: center.y + 8 };
    const sockets = hub.sockets.map((socket) => {
      const projected = {
        ...socket,
        ...socketPosition(
          hubCenter,
          socket.boardPortId,
          hub.isSpecial,
          hub.isSpecial ? 64 : 52,
        ),
      };
      endpointPositions.set(socket.id, projected);
      return projected;
    });
    return { ...hub, ...hubCenter, sockets };
  });
  const focusedBridges = bridges.map((bridge, index) => ({
    ...bridge,
    ...internalPath(
      endpointPositions.get(bridge.first.id),
      endpointPositions.get(bridge.second.id),
      ((index % 5) - 2) * 10,
    ),
  }));
  const targets = openTargets
    .filter((target) => target.value === node.value)
    .map((target) => ({
      ...target,
      ...endpointPositions.get(target.endpoint.id),
    }));
  return {
    value: node.value,
    center,
    radius,
    ports,
    bridges: focusedBridges,
    hubs: focusedHubs,
    targets,
  };
}

function sampleQuadratic(route, segments = 18) {
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const inverse = 1 - t;
    points.push({
      x: inverse * inverse * route.start.x +
        2 * inverse * t * route.control.x +
        t * t * route.end.x,
      y: inverse * inverse * route.start.y +
        2 * inverse * t * route.control.y +
        t * t * route.end.y,
    });
  }
  return points;
}

function properSegmentCrossing(firstA, secondA, firstB, secondB) {
  const orientation = (first, second, third) =>
    (second.x - first.x) * (third.y - first.y) -
    (second.y - first.y) * (third.x - first.x);
  return orientation(firstA, secondA, firstB) *
      orientation(firstA, secondA, secondB) < 0 &&
    orientation(firstB, secondB, firstA) *
      orientation(firstB, secondB, secondA) < 0;
}

function curvesCross(first, second) {
  const firstPoints = sampleQuadratic(first.route);
  const secondPoints = sampleQuadratic(second.route);
  for (let firstIndex = 1; firstIndex < firstPoints.length; firstIndex += 1) {
    for (let secondIndex = 1; secondIndex < secondPoints.length; secondIndex += 1) {
      if (properSegmentCrossing(
        firstPoints[firstIndex - 1],
        firstPoints[firstIndex],
        secondPoints[secondIndex - 1],
        secondPoints[secondIndex],
      )) {
        return true;
      }
    }
  }
  return false;
}

export function analyzePortSceneDensity(scene) {
  let estimatedThreadCrossings = 0;
  for (let firstIndex = 0; firstIndex < scene.threads.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < scene.threads.length;
      secondIndex += 1
    ) {
      const first = scene.threads[firstIndex];
      const second = scene.threads[secondIndex];
      if ([first.a, first.b].some((value) =>
        value === second.a || value === second.b
      )) {
        continue;
      }
      if (curvesCross(first, second)) {
        estimatedThreadCrossings += 1;
      }
    }
  }
  const potentialPorts = scene.nodes.flatMap((node) => node.ordinaryPorts)
    .filter((port) => port.state === "POTENTIAL").length;
  const usedPorts = 42 - potentialPorts;
  const activeBranches = new Set(
    scene.threads
      .filter((thread) => thread.topology.region === "branch")
      .map((thread) => thread.topology.structureId),
  ).size;
  return {
    threadCount: scene.threads.length,
    estimatedThreadCrossings,
    bridgeCount: scene.bridges.length,
    hubCount: scene.hubs.length,
    activeBranches,
    openEndCount: scene.openTargets.length,
    potentialPorts,
    usedPorts,
    primaryMarks: 7 + scene.openTargets.length + scene.hubs.length +
      scene.threads.filter((thread) => thread.isLive).length,
    secondaryMarks: potentialPorts + scene.bridges.length +
      scene.threads.filter((thread) => !thread.isLive).length,
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
    inspectedRouteId = null,
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
  const legalTargetIds = new Set(legalTargets.map(targetIdentity));
  const hasSelection = selectedDominoId !== null;
  const legalEndpointIds = new Set(
    view.portGraph.openTargets
      .filter((target) => legalTargetIds.has(target.id))
      .map((target) => target.endpoint.id),
  );
  const livePlacementIds = new Set(
    view.portGraph.openTargets.map((target) => target.placementId),
  );
  const decisionPlacementIds = new Set(
    view.portGraph.openTargets
      .filter((target) => legalTargetIds.has(target.id))
      .map((target) => target.placementId),
  );
  const endpointPositions = new Map();
  const familyById = new Map(
    view.portGraph.topology.branchFamilies.map((family) => [family.id, family]),
  );
  const nodes = view.portGraph.macroNodes.map((node) => {
    const position = nodePositions.get(node.value);
    const ordinaryPorts = node.ordinaryPorts.map((port) => {
      const projected = {
        ...port,
        ...portPosition(position, nodePositions.get(port.otherValue)),
        isDecisionTarget: legalEndpointIds.has(port.id),
        isLive: port.isOpenEnd,
      };
      if (port.topology) {
        const family = port.topology.familyId
          ? familyById.get(port.topology.familyId)
          : null;
        Object.assign(projected, inspectionState({
          structureId: port.topology.structureId,
          familyId: port.topology.familyId,
          rootPlacementId: family?.originPlacementId ?? null,
          placementId: port.placementId,
          inspectedStructureId,
          inspectedRouteId,
        }));
      }
      endpointPositions.set(port.id, projected);
      return projected;
    });
    return { ...node, ...position, ordinaryPorts };
  });
  const hubs = view.portGraph.doubleHubs.map((hub) => {
    const node = nodePositions.get(hub.value);
    const hubCenter = { x: node.x, y: node.y + 15 };
    const sockets = hub.sockets.map((socket) => {
      const projected = {
        ...socket,
        ...socketPosition(hubCenter, socket.boardPortId, hub.isSpecial),
        isDecisionTarget: legalEndpointIds.has(socket.id),
      };
      endpointPositions.set(socket.id, projected);
      return projected;
    });
    return { ...hub, ...hubCenter, sockets };
  });
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
    const family = thread.topology.familyId
      ? familyById.get(thread.topology.familyId)
      : null;
    const first = endpointPositions.get(thread.fromPortId);
    const second = endpointPositions.get(thread.toPortId);
    return {
      ...thread,
      ...threadRoute(thread, first, second, nodePositions, geometry),
      familyTone: thread.topology.familyIndex === null
        ? null
        : thread.topology.familyIndex % 4,
      isLive: livePlacementIds.has(thread.placementId),
      isDecisionOwner: decisionPlacementIds.has(thread.placementId),
      ...inspectionState({
        structureId: thread.topology.structureId,
        familyId: thread.topology.familyId,
        rootPlacementId: family?.originPlacementId ?? null,
        placementId: thread.placementId,
        inspectedStructureId,
        inspectedRouteId,
      }),
    };
  });
  const bridgesByValue = new Map(nodes.map((node) => [node.value, []]));
  const bridgeIndexByValue = new Map(nodes.map((node) => [node.value, 0]));
  const bridges = view.portGraph.internalBridges.map((bridge) => {
    const family = bridge.familyId ? familyById.get(bridge.familyId) : null;
    const localIndex = bridgeIndexByValue.get(bridge.value);
    bridgeIndexByValue.set(bridge.value, localIndex + 1);
    const projected = {
      ...bridge,
      ...internalPath(
        endpointPositions.get(bridge.first.id),
        endpointPositions.get(bridge.second.id),
        ((localIndex % 5) - 2) * 5,
      ),
      familyTone: bridge.familyIndex === null
        ? null
        : bridge.familyIndex % 4,
      isLive: livePlacementIds.has(bridge.first.placementId) ||
        livePlacementIds.has(bridge.second.placementId),
      isDecisionOwner: decisionPlacementIds.has(bridge.first.placementId) ||
        decisionPlacementIds.has(bridge.second.placementId),
      ...inspectionState({
        structureId: bridge.structureId,
        familyId: bridge.familyId,
        rootPlacementId: family?.originPlacementId ?? null,
        placementId: bridge.first.placementId,
        inspectedStructureId,
        inspectedRouteId,
      }),
    };
    bridgesByValue.get(bridge.value).push(projected);
    return projected;
  });
  const projectedHubs = hubs.map((hub) => {
    const rootedFamily = hub.topology.branchFamily
      ? familyById.get(hub.topology.branchFamily.id)
      : null;
    const ownFamily = hub.topology.familyId
      ? familyById.get(hub.topology.familyId)
      : null;
    const hubInspection = inspectionState({
      structureId: hub.topology.structureId,
      familyId: hub.topology.familyId,
      rootPlacementId: null,
      placementId: hub.placementId,
      inspectedStructureId,
      inspectedRouteId,
    });
    const isInspectedBranchRoot = inspectedRouteId !== null
      ? rootedFamily?.arms.some((arm) => arm.id === inspectedRouteId) ?? false
      : inspectedStructureId !== null &&
        rootedFamily?.id === inspectedStructureId;
    return {
      ...hub,
      isLive: hub.sockets.some((socket) => socket.isOpenEnd),
      isDecisionOwner: decisionPlacementIds.has(hub.placementId),
      isScoringTerm: scoringHubPlacementIds.has(hub.placementId),
      ...hubInspection,
      isTopologyDimmed: isInspectedBranchRoot
        ? false
        : hubInspection.isTopologyDimmed,
      isTopologyRoot: isInspectedBranchRoot ||
        hubInspection.isTopologyRoot ||
        ownFamily?.originPlacementId === hub.placementId &&
          hubInspection.isTopologyHighlighted,
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
      ...inspectionState({
        structureId: target.topology.structureId,
        familyId: target.topology.familyId,
        rootPlacementId: family?.originPlacementId ?? null,
        placementId: target.placementId,
        inspectedStructureId,
        inspectedRouteId,
      }),
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
  const nodeFocus = createNodeFocus({
    node: expandedNode,
    bridges: expandedNode ? bridgesByValue.get(expandedNode.value) : [],
    hubs: expandedNode
      ? projectedHubs.filter((hub) => hub.value === expandedNode.value)
      : [],
    openTargets,
    geometry,
  });
  const inspectionActive = inspectedRouteId !== null ||
    inspectedStructureId !== null;

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
    visualState: expandedNode ? "node-focus" : inspectionActive
      ? "inspection"
      : hasSelection
        ? "decision"
        : "rest",
    hasSelection,
    selectedDominoId,
    inspectedStructureId,
    inspectedPlacementId,
    inspectedRouteId,
    expandedNodeValue,
    nodeInspector,
    nodeFocus,
    canStart: hasSelection && legalTargetIds.has("START"),
    nodes,
    threads,
    bridges,
    hubs: projectedHubs,
    openTargets,
  };
}
