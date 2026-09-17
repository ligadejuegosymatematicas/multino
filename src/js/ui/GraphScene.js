export const GRAPH_SCENE_LAYOUTS = Object.freeze({
  COMPACT: "compact",
  WIDE: "wide",
});

const LAYOUT_GEOMETRY = Object.freeze({
  [GRAPH_SCENE_LAYOUTS.COMPACT]: Object.freeze({
    width: 760,
    height: 620,
    center: Object.freeze({ x: 380, y: 300 }),
    radii: Object.freeze({ x: 245, y: 205 }),
    orbit: Object.freeze({ rx: 218, ry: 218 }),
  }),
  [GRAPH_SCENE_LAYOUTS.WIDE]: Object.freeze({
    width: 960,
    height: 620,
    center: Object.freeze({ x: 480, y: 305 }),
    radii: Object.freeze({ x: 310, y: 230 }),
    orbit: Object.freeze({ rx: 280, ry: 205 }),
  }),
});
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

function getVertexPosition(value, geometry) {
  const angle = -Math.PI / 2 + (FULL_TURN * value) / 7;
  return {
    value,
    x: round(geometry.center.x + Math.cos(angle) * geometry.radii.x),
    y: round(geometry.center.y + Math.sin(angle) * geometry.radii.y),
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

function createPotentialStructure(positions) {
  const edges = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a + 1; b <= 6; b += 1) {
      edges.push({
        id: `potential-${a}-${b}`,
        a,
        b,
        ...lineBetweenVertices(positions.get(a), positions.get(b)),
      });
    }
  }
  const loops = Array.from({ length: 7 }, (_, value) =>
    createLoop(
      { id: `potential-${value}-${value}`, a: value, b: value },
      positions.get(value),
    )
  );
  return { edges, loops };
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
  optionIndex,
  compatibleCount,
  hasSelection,
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
    ? "recorrido inicial"
    : `brazo ${target.topology.armIndex} del chancho ramificador`;
  const selectionLabel = !hasSelection
    ? "; activar para inspeccionar la estructura"
    : isLegal
      ? optionIndex === null
        ? "; destino compatible"
        : `; opción ${optionIndex} de ${compatibleCount}`
      : "; destino no compatible; activar para inspeccionar la estructura";
  return {
    ...target,
    index: index + 1,
    count,
    path: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    endX: end.x,
    endY: end.y,
    isLegal,
    optionIndex,
    familyTone: target.topology.familyIndex === null
      ? null
      : target.topology.familyIndex % 4,
    ...topologyState,
    accessibleLabel: `Extremo abierto, ${structureLabel}, valor ${target.value}${selectionLabel}`,
  };
}

function targetIdentity(target) {
  return target.kind === "START" ? "START" : target.id;
}

function createTopologyInspection(
  view,
  inspectedStructureId,
  inspectedPlacementId,
  topologyByPlacementId,
) {
  if (inspectedStructureId === null) {
    return null;
  }

  const placement = inspectedPlacementId === null
    ? null
    : topologyByPlacementId.get(inspectedPlacementId) ?? null;
  const edge = placement
    ? view.edges.find(
        (candidate) => candidate.placementId === inspectedPlacementId,
      ) ?? null
    : null;

  if (inspectedStructureId === "main") {
    return {
      kind: "main",
      structureId: "main",
      structureCode: "P",
      structureLabel: "Recorrido inicial",
      placementId: placement?.placementId ?? null,
      dominoId: edge?.dominoId ?? null,
      topology: placement,
      structurePlacementIds: [...view.topology.mainLine.placementIds],
      rootPlacementId: null,
      rootDominoId: null,
      rootTopology: null,
      arms: [],
    };
  }

  const family = view.topology.branchFamilies.find(
    (candidate) => candidate.id === inspectedStructureId,
  );
  if (!family) {
    return null;
  }
  const rootEdge = view.edges.find(
    (candidate) => candidate.placementId === family.originPlacementId,
  );
  const rootTopology = topologyByPlacementId.get(family.originPlacementId);

  return {
    kind: "family",
    structureId: family.id,
    structureCode: family.code,
    structureLabel: family.label,
    familyIndex: family.familyIndex,
    placementId: placement?.placementId ?? null,
    dominoId: edge?.dominoId ?? null,
    topology: placement,
    structurePlacementIds: family.arms.flatMap(
      (arm) => arm.placementIds,
    ),
    rootPlacementId: family.originPlacementId,
    rootDominoId: rootEdge?.dominoId ?? null,
    rootTopology,
    arms: family.arms.map((arm) => ({
      armIndex: arm.armIndex,
      isOccupied: arm.isOccupied,
      placementIds: [...arm.placementIds],
    })),
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
    inspectedStructureId = null,
    inspectedPlacementId = null,
    layout = GRAPH_SCENE_LAYOUTS.COMPACT,
    scoringResolution = null,
  } = {},
) {
  const geometry = LAYOUT_GEOMETRY[layout];
  if (!geometry) {
    throw new TypeError(`Layout de grafo desconocido: ${layout}.`);
  }
  const positions = new Map(
    view.vertices.map((vertex) => [
      vertex.value,
      getVertexPosition(vertex.value, geometry),
    ]),
  );
  const potentialStructure = createPotentialStructure(positions);
  const legalTargetIds = new Set(legalTargets.map(targetIdentity));
  const scoringPortIds = new Set(
    (scoringResolution?.terms ?? [])
      .filter((term) => term.portId !== null)
      .map((term) => `${term.placementId}:${term.portId}`),
  );
  const scoringDoublePlacementIds = new Set(
    (scoringResolution?.terms ?? [])
      .filter((term) => term.isDouble)
      .map((term) => term.placementId),
  );
  const scoringValues = new Set(
    (scoringResolution?.terms ?? [])
      .filter((term) => term.isContributing)
      .map((term) => term.value),
  );
  const hasSelection = selectedDominoId !== null;
  const topologyByPlacementId = new Map(
    view.topology.placements.map((placement) => [
      placement.placementId,
      placement,
    ]),
  );
  const openFamilyIds = new Set(
    view.openEndsByValue.flatMap((group) =>
      group.targets
        .map((target) => target.topology.familyId)
        .filter((familyId) => familyId != null)
    ),
  );
  const inspection = createTopologyInspection(
    view,
    inspectedStructureId,
    inspectedPlacementId,
    topologyByPlacementId,
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
    const compatibleCount = group.targets.filter(
      (target) => hasSelection && legalTargetIds.has(target.id),
    ).length;
    let compatibleIndex = 0;
    group.targets.forEach((target, index) => {
      const isLegal = hasSelection && legalTargetIds.has(target.id);
      if (isLegal) {
        compatibleIndex += 1;
      }
      const targetStructureId = target.topology.familyId ?? "main";
      const isTopologyHighlighted =
        inspection !== null &&
        targetStructureId === inspection.structureId;
      const projectedTarget = createOpenTarget(
        target,
        index,
        group.targets.length,
        vertex,
        angles[index],
        isLegal,
        isLegal && compatibleCount > 1 ? compatibleIndex : null,
        compatibleCount,
        hasSelection,
        {
          isTopologyHighlighted,
          isTopologyDimmed:
            inspection !== null && !isTopologyHighlighted,
          isScoringTerm: scoringPortIds.has(target.id),
          isFamilyClosed:
            view.roundStatus.phase === "finished" &&
            target.topology.region === "branch",
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
    const edgeStructureId = topology.familyId ?? "main";
    const topologyState = {
      topology,
      familyTone: topology.familyIndex === null
        ? null
        : topology.familyIndex % 4,
      isInspected: edge.placementId === inspection?.placementId,
      isTopologyHighlighted:
        inspection !== null && edgeStructureId === inspection.structureId,
      isTopologyRoot: edge.placementId === inspection?.rootPlacementId,
      isTopologyDimmed:
        inspection !== null &&
        edgeStructureId !== inspection.structureId &&
        edge.placementId !== inspection.rootPlacementId,
      isScoringTerm: scoringDoublePlacementIds.has(edge.placementId),
      isFamilyClosed:
        topology.branchFamily !== null &&
        (view.roundStatus.phase === "finished" ||
          !openFamilyIds.has(topology.branchFamily.id)),
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
    viewBox: `0 0 ${geometry.width} ${geometry.height}`,
    width: geometry.width,
    height: geometry.height,
    layout,
    orbit: {
      cx: geometry.center.x,
      cy: geometry.center.y,
      rx: geometry.orbit.rx,
      ry: geometry.orbit.ry,
    },
    hasSelection,
    selectedDominoId,
    inspection,
    topologySummary: {
      structuralMode: view.topology.structuralMode,
      ...view.topology.branchingDouble,
    },
    canStart: hasSelection && legalTargetIds.has("START"),
    vertices: view.vertices.map((vertex) => ({
      ...vertex,
      ...positions.get(vertex.value),
      legalTargetIds: legalTargetIdsByValue.get(vertex.value) ?? [],
      isCompatible: legalTargetIdsByValue.has(vertex.value),
      isScoringTerm: scoringValues.has(vertex.value),
    })),
    potentialEdges: potentialStructure.edges,
    potentialLoops: potentialStructure.loops,
    edges,
    loops,
    openTargets,
  };
}
