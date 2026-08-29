const VIEWBOX = Object.freeze({ width: 760, height: 620 });
const CENTER = Object.freeze({ x: 380, y: 300 });
const RADII = Object.freeze({ x: 245, y: 205 });
const VERTEX_RADIUS = 35;
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

function getVertexPosition(value) {
  const angle = -Math.PI / 2 + (FULL_TURN * value) / 7;
  return {
    value,
    x: round(CENTER.x + Math.cos(angle) * RADII.x),
    y: round(CENTER.y + Math.sin(angle) * RADII.y),
    outwardAngle: angle,
  };
}

function lineBetweenVertices(first, second) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const distance = Math.hypot(dx, dy);
  const unitX = dx / distance;
  const unitY = dy / distance;
  const start = {
    x: round(first.x + unitX * (VERTEX_RADIUS + 5)),
    y: round(first.y + unitY * (VERTEX_RADIUS + 5)),
  };
  const end = {
    x: round(second.x - unitX * (VERTEX_RADIUS + 5)),
    y: round(second.y - unitY * (VERTEX_RADIUS + 5)),
  };
  return {
    path: `M ${start.x} ${start.y} L ${end.x} ${end.y}`,
    labelX: round((start.x + end.x) / 2),
    labelY: round((start.y + end.y) / 2),
  };
}

function createLoop(edge, vertex) {
  const tangentAngle = vertex.outwardAngle + Math.PI / 2;
  const base = pointAt(vertex, vertex.outwardAngle, VERTEX_RADIUS - 2);
  const start = pointAt(base, tangentAngle, 21);
  const end = pointAt(base, tangentAngle + Math.PI, 21);
  const firstControl = pointAt(start, vertex.outwardAngle + 0.22, 79);
  const secondControl = pointAt(end, vertex.outwardAngle - 0.22, 79);
  const closeControlA = pointAt(end, vertex.outwardAngle + Math.PI / 2, 20);
  const closeControlB = pointAt(start, vertex.outwardAngle - Math.PI / 2, 20);
  const label = pointAt(vertex, vertex.outwardAngle, 103);
  return {
    ...edge,
    path: [
      `M ${start.x} ${start.y}`,
      `C ${firstControl.x} ${firstControl.y} ${secondControl.x} ${secondControl.y} ${end.x} ${end.y}`,
      `C ${closeControlA.x} ${closeControlA.y} ${closeControlB.x} ${closeControlB.y} ${start.x} ${start.y}`,
      "Z",
    ].join(" "),
    labelX: label.x,
    labelY: label.y,
  };
}

function getTargetAngles(vertex, count, hasLoop) {
  if (count === 1) {
    return [vertex.outwardAngle + (hasLoop ? 0.9 : 0)];
  }
  if (hasLoop) {
    const start = vertex.outwardAngle + 0.72;
    const span = FULL_TURN - 1.44;
    return Array.from(
      { length: count },
      (_, index) => start + (span * index) / (count - 1),
    );
  }
  const span = Math.min(2.55, 0.4 * (count - 1));
  const start = vertex.outwardAngle - span / 2;
  return Array.from(
    { length: count },
    (_, index) => start + (span * index) / (count - 1),
  );
}

function createOpenTarget(
  target,
  index,
  count,
  vertex,
  angle,
  isLegal,
  topologyState,
) {
  const start = pointAt(vertex, angle, VERTEX_RADIUS - 1);
  const end = pointAt(vertex, angle, 91);
  const bendDirection = index % 2 === 0 ? 1 : -1;
  const controlOrigin = pointAt(vertex, angle, 61);
  const control = pointAt(
    controlOrigin,
    angle + bendDirection * Math.PI / 2,
    Math.min(12, 4 + count),
  );
  const structureLabel = target.topology.region === "main"
    ? "línea principal"
    : target.topology.structureLabel;
  return {
    ...target,
    index: index + 1,
    count,
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    endX: end.x,
    endY: end.y,
    isLegal,
    ...topologyState,
    accessibleLabel: `Extremo abierto ${target.topology.structureCode}, ${structureLabel}, valor ${target.value}; opción ${index + 1} de ${count}`,
  };
}

function targetIdentity(target) {
  return target.kind === "START" ? "START" : target.id;
}

function createTopologyInspection(
  view,
  inspectedPlacementId,
  topologyByPlacementId,
) {
  if (inspectedPlacementId === null) {
    return null;
  }

  const placement = topologyByPlacementId.get(inspectedPlacementId);
  const edge = view.edges.find(
    (candidate) => candidate.placementId === inspectedPlacementId,
  );
  if (!placement || !edge) {
    return null;
  }

  const branch = placement.region === "branch"
    ? view.topology.branches.find(
        (candidate) => candidate.id === placement.structureId,
      )
    : null;
  const structurePlacementIds = placement.region === "main"
    ? view.topology.mainLine.placementIds
    : branch.placementIds;
  const rootEdge = branch
    ? view.edges.find(
        (candidate) =>
          candidate.placementId === branch.originPlacementId,
      )
    : null;

  return {
    placementId: inspectedPlacementId,
    dominoId: edge.dominoId,
    a: edge.a,
    b: edge.b,
    topology: placement,
    structurePlacementIds: [...structurePlacementIds],
    rootPlacementId: branch?.originPlacementId ?? null,
    rootDominoId: rootEdge?.dominoId ?? null,
    structureCode: placement.structureCode,
    structureLabel: placement.structureLabel,
  };
}

/**
 * Geometría descartable del renderer. Consume proyección, nunca el snapshot.
 */
export function createGraphScene(
  view,
  {
    selectedDominoId = null,
    legalTargets = [],
    inspectedPlacementId = null,
  } = {},
) {
  const positions = new Map(
    view.vertices.map((vertex) => [vertex.value, getVertexPosition(vertex.value)]),
  );
  const legalTargetIds = new Set(legalTargets.map(targetIdentity));
  const hasSelection = selectedDominoId !== null;
  const topologyByPlacementId = new Map(
    view.topology.placements.map((placement) => [
      placement.placementId,
      placement,
    ]),
  );
  const inspection = createTopologyInspection(
    view,
    inspectedPlacementId,
    topologyByPlacementId,
  );
  const highlightedPlacementIds = new Set(
    inspection?.structurePlacementIds ?? [],
  );
  const loopValues = new Set(
    view.edges.filter((edge) => edge.isLoop).map((edge) => edge.a),
  );
  const openTargets = [];
  const legalTargetIdsByValue = new Map();

  for (const group of view.openEndsByValue) {
    const vertex = positions.get(group.value);
    const angles = getTargetAngles(
      vertex,
      group.targets.length,
      loopValues.has(group.value),
    );
    group.targets.forEach((target, index) => {
      const isLegal = hasSelection && legalTargetIds.has(target.id);
      const isTopologyHighlighted =
        inspection !== null &&
        target.topology.structureId === inspection.topology.structureId;
      const projectedTarget = createOpenTarget(
        target,
        index,
        group.targets.length,
        vertex,
        angles[index],
        isLegal,
        {
          isTopologyHighlighted,
          isTopologyDimmed:
            inspection !== null && !isTopologyHighlighted,
        },
      );
      openTargets.push(projectedTarget);
      if (isLegal) {
        const ids = legalTargetIdsByValue.get(group.value) ?? [];
        ids.push(target.id);
        legalTargetIdsByValue.set(group.value, ids);
      }
    });
  }

  const edges = [];
  const loops = [];
  for (const edge of view.edges) {
    const topology = topologyByPlacementId.get(edge.placementId);
    const topologyState = {
      topology,
      isInspected: edge.placementId === inspection?.placementId,
      isTopologyHighlighted: highlightedPlacementIds.has(edge.placementId),
      isTopologyRoot: edge.placementId === inspection?.rootPlacementId,
      isTopologyDimmed:
        inspection !== null &&
        !highlightedPlacementIds.has(edge.placementId) &&
        edge.placementId !== inspection.rootPlacementId,
    };
    if (edge.isLoop) {
      loops.push(
        createLoop(
          { ...edge, ...topologyState },
          positions.get(edge.a),
        ),
      );
      continue;
    }
    edges.push({
      ...edge,
      ...topologyState,
      ...lineBetweenVertices(positions.get(edge.a), positions.get(edge.b)),
    });
  }

  return {
    viewBox: `0 0 ${VIEWBOX.width} ${VIEWBOX.height}`,
    width: VIEWBOX.width,
    height: VIEWBOX.height,
    hasSelection,
    selectedDominoId,
    inspection,
    topologySummary: { ...view.topology.specialDoubles },
    canStart: hasSelection && legalTargetIds.has("START"),
    vertices: view.vertices.map((vertex) => ({
      ...vertex,
      ...positions.get(vertex.value),
      legalTargetIds: legalTargetIdsByValue.get(vertex.value) ?? [],
      isCompatible: legalTargetIdsByValue.has(vertex.value),
    })),
    edges,
    loops,
    openTargets,
    multiplicities: view.openEndsByValue
      .filter((group) => group.count > 1)
      .map((group) => {
        const vertex = positions.get(group.value);
        const label = pointAt(vertex, vertex.outwardAngle + Math.PI / 2, 47);
        return {
          value: group.value,
          count: group.count,
          x: label.x,
          y: label.y,
        };
      }),
  };
}
