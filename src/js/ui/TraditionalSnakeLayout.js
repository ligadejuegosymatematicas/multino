const TILE_LONG = 72;
const TILE_SHORT = 38;
const TILE_GAP = 12;
const TURN_LEG = 18;
const COLLISION_MARGIN = 14;
const SOFT_HALF_WIDTH = 350;
const SOFT_HALF_HEIGHT = 270;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 260;
const TABLE_PADDING = 52;
const STABLE_CANVAS_WIDTH = 1000;
const STABLE_CANVAS_HEIGHT = 800;
const LOOKAHEAD_STEPS = 5;
const ESCAPE_LOOKAHEAD_STEPS = 3;
const SOFT_TURN_RUN_START = 4;
const SOFT_BOUNDARY_START = 0.7;
const CONNECTOR_MARGIN = 6;
const STRAIGHT_CONNECTOR_LIMIT = TILE_GAP + CONNECTOR_MARGIN;
const ELBOW_CONNECTOR_LIMIT = TILE_GAP + TURN_LEG * 2 + CONNECTOR_MARGIN;
const MAX_CONNECTOR_LENGTH = ELBOW_CONNECTOR_LIMIT;
const MAX_LOCAL_EXPANSION_STEPS = 1;
const TURN_LEAD_ADJUSTMENTS = Object.freeze([-8, 0, 8]);
const PROTECTED_EXIT_PENALTY = 60000;

export const TRADITIONAL_COLLISION_MARGIN = COLLISION_MARGIN;
export const TRADITIONAL_TILE_LONG = TILE_LONG;
export const TRADITIONAL_TILE_SHORT = TILE_SHORT;
export const TRADITIONAL_MAX_CONNECTOR_LENGTH = MAX_CONNECTOR_LENGTH;

const VECTOR = Object.freeze({
  right: Object.freeze({ x: 1, y: 0 }),
  down: Object.freeze({ x: 0, y: 1 }),
  left: Object.freeze({ x: -1, y: 0 }),
  up: Object.freeze({ x: 0, y: -1 }),
});

const CLOCKWISE = Object.freeze({
  right: "down",
  down: "left",
  left: "up",
  up: "right",
});

const COUNTERCLOCKWISE = Object.freeze({
  right: "up",
  up: "left",
  left: "down",
  down: "right",
});

function isHorizontal(direction) {
  return direction === "left" || direction === "right";
}

function dimensionsFor(tile, direction) {
  const vertical = tile.isDouble ? isHorizontal(direction) : !isHorizontal(direction);
  return {
    orientation: vertical ? "vertical" : "horizontal",
    width: vertical ? TILE_SHORT : TILE_LONG,
    height: vertical ? TILE_LONG : TILE_SHORT,
  };
}

function sidesFor(direction) {
  switch (direction) {
    case "right": return { start: "left", end: "right" };
    case "left": return { start: "right", end: "left" };
    case "up": return { start: "bottom", end: "top" };
    case "down": return { start: "top", end: "bottom" };
    default:
      throw new TypeError(`Dirección tradicional desconocida: ${direction}.`);
  }
}

function valueAtSide(tile, sides, physicalSide, fallbackIndex) {
  if (sides.start === physicalSide) return tile.start.value;
  if (sides.end === physicalSide) return tile.end.value;
  return tile.values[fallbackIndex];
}

function projectTile(tile, x, y, direction) {
  const dimensions = dimensionsFor(tile, direction);
  const sides = sidesFor(direction);
  const firstSide = dimensions.orientation === "horizontal" ? "left" : "top";
  const secondSide = dimensions.orientation === "horizontal" ? "right" : "bottom";
  return {
    ...tile,
    ...dimensions,
    x,
    y,
    direction,
    physicalStart: { ...tile.start, side: sides.start },
    physicalEnd: { ...tile.end, side: sides.end },
    firstValue: valueAtSide(tile, sides, firstSide, 0),
    secondValue: valueAtSide(tile, sides, secondSide, 1),
  };
}

function reverseTile(tile) {
  return {
    ...tile,
    values: [...tile.values],
    start: { ...tile.end },
    end: { ...tile.start },
    layoutReversed: !tile.layoutReversed,
  };
}

function refreshProjectedTile(tile, rawTile) {
  const oriented = tile.layoutReversed ? reverseTile(rawTile) : rawTile;
  return {
    ...projectTile(oriented, tile.x, tile.y, tile.direction),
    straightRunLength: tile.straightRunLength ?? 1,
    turnReason: tile.turnReason ?? "origin",
    escapeDepth: tile.escapeDepth ?? ESCAPE_LOOKAHEAD_STEPS,
    protectedExitsPreserved: tile.protectedExitsPreserved ?? true,
  };
}

export function traditionalTileBounds(tile, margin = 0) {
  return {
    left: tile.x - tile.width / 2 - margin,
    right: tile.x + tile.width / 2 + margin,
    top: tile.y - tile.height / 2 - margin,
    bottom: tile.y + tile.height / 2 + margin,
  };
}

export function traditionalBoundsOverlap(first, second) {
  return first.left < second.right && first.right > second.left &&
    first.top < second.bottom && first.bottom > second.top;
}

export function pointOutsideTraditionalTile(tile, face, distance) {
  switch (face.side) {
    case "left": return { x: tile.x - tile.width / 2 - distance, y: tile.y };
    case "right": return { x: tile.x + tile.width / 2 + distance, y: tile.y };
    case "top": return { x: tile.x, y: tile.y - tile.height / 2 - distance };
    case "bottom": return { x: tile.x, y: tile.y + tile.height / 2 + distance };
    default:
      throw new TypeError(`Cara tradicional desconocida: ${face.side}.`);
  }
}

function collides(candidate, occupied) {
  const candidateBounds = traditionalTileBounds(
    candidate,
    COLLISION_MARGIN / 2,
  );
  return occupied.some((tile) => traditionalBoundsOverlap(
    candidateBounds,
    traditionalTileBounds(tile, COLLISION_MARGIN / 2),
  ));
}

function segmentBounds(segment, margin = 0) {
  return {
    left: Math.min(segment.x, segment.x2) - margin,
    right: Math.max(segment.x, segment.x2) + margin,
    top: Math.min(segment.y, segment.y2) - margin,
    bottom: Math.max(segment.y, segment.y2) + margin,
  };
}

export function traditionalSegmentsConflict(
  first,
  second,
  margin = CONNECTOR_MARGIN,
) {
  if (!traditionalBoundsOverlap(
    segmentBounds(first, margin / 2),
    segmentBounds(second, margin / 2),
  )) return false;
  // Dos conexiones reglamentarias diferentes nunca comparten un socket. Un
  // punto geométrico coincidente entre ellas es, por tanto, una unión falsa y
  // no un endpoint legítimo que debamos exceptuar.
  return true;
}

export function traditionalConnectorLength(segments) {
  return segments.reduce(
    (total, segment) => total +
      Math.abs(segment.x2 - segment.x) + Math.abs(segment.y2 - segment.y),
    0,
  );
}

function connectorLengthLimit(segments) {
  return segments.length > 1
    ? ELBOW_CONNECTOR_LIMIT
    : STRAIGHT_CONNECTOR_LIMIT;
}

function connectorGeometryIsSafe(
  segments,
  source,
  candidate,
  occupied,
  occupiedConnections,
) {
  const connectorLength = traditionalConnectorLength(segments);
  if (connectorLength > connectorLengthLimit(segments)) return false;
  if (traditionalBoundsOverlap(
    traditionalTileBounds(candidate),
    traditionalTileBounds(source),
  )) return false;
  const obstacles = occupied.filter(
    (tile) => tile.placementId !== source.placementId,
  );
  if (collides(candidate, obstacles)) return false;
  if (obstacles.some((obstacle) => connectorInvadesTile(segments, obstacle))) {
    return false;
  }
  return !connectorConflicts(segments, occupiedConnections);
}

function createProbeTile(id, isDouble = false, isSpecialDouble = false) {
  return {
    placementId: `probe:${id}`,
    dominoId: isDouble ? "probe-double" : "probe-ordinary",
    values: isDouble ? [0, 0] : [0, 1],
    isDouble,
    isSpecialDouble,
    doubleRole: isSpecialDouble
      ? "BRANCHING_DOUBLE"
      : isDouble ? "ORDINARY_DOUBLE" : null,
    region: "probe",
    start: {
      portId: "probe:start",
      value: 0,
      connectionId: null,
      neighborPlacementId: null,
    },
    end: {
      portId: "probe:end",
      value: isDouble ? 0 : 1,
      connectionId: null,
      neighborPlacementId: null,
    },
  };
}

function ramifierFitsAtExit(
  anchor,
  face,
  occupied,
  occupiedConnections,
  connectionClearance,
) {
  const currentDirection = directionForSide(face.side);
  for (const direction of candidateDirections(currentDirection, true)) {
    const leadAdjustments = direction === currentDirection
      ? [0]
      : TURN_LEAD_ADJUSTMENTS;
    for (const turnLeadAdjustment of leadAdjustments) {
      const geometry = buildCandidateGeometry({
        rawTile: createProbeTile(
          `${anchor.placementId}:ramifier:${direction}`,
          true,
          true,
        ),
        source: anchor,
        sourceFace: face,
        direction,
        currentDirection,
        connectionClearance,
        turnLeadAdjustment,
      });
      if (!connectorGeometryIsSafe(
        geometry.connectorSegments,
        anchor,
        geometry.tile,
        occupied,
        occupiedConnections,
      )) continue;
      const nextOccupied = [...occupied, geometry.tile];
      const nextConnections = [
        ...occupiedConnections,
        {
          id: geometry.tile.placementId,
          firstPlacementId: anchor.placementId,
          secondPlacementId: geometry.tile.placementId,
          segments: geometry.connectorSegments,
        },
      ];
      const exitFaces = [geometry.tile.physicalEnd, ...[1, 2].map(
        (armIndex) => {
          const armDirection = branchDirection(geometry.tile, armIndex);
          return {
            portId: `branch:${armIndex}`,
            value: geometry.tile.values[0],
            side: sidesFor(armDirection).end,
          };
        },
      )];
      if (exitFaces.every((exitFace) => escapeDepthFromOpenFace(
        geometry.tile,
        exitFace,
        nextOccupied,
        nextConnections,
        connectionClearance,
      ) >= 3)) return true;
    }
  }
  return false;
}

function connectorInvadesTile(segments, tile, margin = CONNECTOR_MARGIN) {
  const tileBox = traditionalTileBounds(tile, margin / 2);
  return segments.some((segment) => traditionalBoundsOverlap(
    segmentBounds(segment, margin / 2),
    tileBox,
  ));
}

function connectorConflicts(segments, connections) {
  return connections.some((connection) =>
    connection.segments.some((segment) =>
      segments.some((candidate) =>
        traditionalSegmentsConflict(candidate, segment)
      )
    )
  );
}

function flattenLayoutConnections(connections = []) {
  return connections.map((connection) => ({
    id: connection.id,
    firstPlacementId: connection.firstPlacementId,
    secondPlacementId: connection.secondPlacementId,
    segments: connection.segments.map((segment) => ({ ...segment })),
  }));
}

function withinSoftBoard(tile, center = { x: 0, y: 0 }) {
  const bounds = traditionalTileBounds(tile);
  return bounds.left >= center.x - SOFT_HALF_WIDTH &&
    bounds.right <= center.x + SOFT_HALF_WIDTH &&
    bounds.top >= center.y - SOFT_HALF_HEIGHT &&
    bounds.bottom <= center.y + SOFT_HALF_HEIGHT;
}

function hasForwardRoom(tile, direction, center = { x: 0, y: 0 }) {
  const bounds = traditionalTileBounds(tile);
  const reserve = TILE_LONG + TILE_GAP + COLLISION_MARGIN;
  switch (direction) {
    case "right": return bounds.right + reserve <= center.x + SOFT_HALF_WIDTH;
    case "left": return bounds.left - reserve >= center.x - SOFT_HALF_WIDTH;
    case "down": return bounds.bottom + reserve <= center.y + SOFT_HALF_HEIGHT;
    case "up": return bounds.top - reserve >= center.y - SOFT_HALF_HEIGHT;
    default: return false;
  }
}

function extentAlong(tile, direction) {
  return isHorizontal(direction) ? tile.width / 2 : tile.height / 2;
}

function placeAfterFace(
  source,
  sourceFace,
  tile,
  direction,
  previousDirection,
  connectionClearance,
  extraDistance = 0,
  turnLeadAdjustment = 0,
) {
  const vector = VECTOR[direction];
  const dimensions = dimensionsFor(tile, direction);
  let x;
  let y;
  if (direction === previousDirection) {
    const distance = extentAlong(source, direction) + TILE_GAP +
      extentAlong(dimensions, direction) + extraDistance;
    x = source.x + vector.x * distance;
    y = source.y + vector.y * distance;
  } else {
    const oldVector = VECTOR[previousDirection];
    const start = pointOutsideTraditionalTile(
      source,
      sourceFace,
      connectionClearance,
    );
    const firstLeg = TURN_LEG + turnLeadAdjustment + extraDistance;
    const secondLeg = TURN_LEG + connectionClearance +
      extentAlong(dimensions, direction);
    x = start.x + oldVector.x * firstLeg + vector.x * secondLeg;
    y = start.y + oldVector.y * firstLeg + vector.y * secondLeg;
  }
  return projectTile(tile, x, y, direction);
}

function futureRoomScore(candidate, direction, occupied, center) {
  const vector = VECTOR[direction];
  const step = extentAlong(candidate, direction) * 2 + TILE_GAP;
  let score = 0;
  for (let index = 1; index <= LOOKAHEAD_STEPS; index += 1) {
    const projected = {
      ...candidate,
      x: candidate.x + vector.x * step * index,
      y: candidate.y + vector.y * step * index,
    };
    if (collides(projected, occupied)) break;
    score += withinSoftBoard(projected, center) ? 180 : 45;
  }
  return score;
}

function compactBounds(tiles) {
  if (tiles.length === 0) {
    return { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0 };
  }
  const bounds = tiles.map((tile) => traditionalTileBounds(tile));
  const left = Math.min(...bounds.map((box) => box.left));
  const right = Math.max(...bounds.map((box) => box.right));
  const top = Math.min(...bounds.map((box) => box.top));
  const bottom = Math.max(...bounds.map((box) => box.bottom));
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function envelopeGrowth(candidate, occupied) {
  const before = compactBounds(occupied);
  const after = compactBounds([...occupied, candidate]);
  return Math.max(0, after.width - before.width) +
    Math.max(0, after.height - before.height);
}

function softBoundaryPressure(candidate, center) {
  const xRatio = Math.abs(candidate.x - center.x) / SOFT_HALF_WIDTH;
  const yRatio = Math.abs(candidate.y - center.y) / SOFT_HALF_HEIGHT;
  const normalize = (ratio) => Math.max(
    0,
    (ratio - SOFT_BOUNDARY_START) / (1 - SOFT_BOUNDARY_START),
  );
  return normalize(xRatio) + normalize(yRatio);
}

function candidateDirections(currentDirection, clockwiseFirst) {
  const turns = clockwiseFirst
    ? [CLOCKWISE[currentDirection], COUNTERCLOCKWISE[currentDirection]]
    : [COUNTERCLOCKWISE[currentDirection], CLOCKWISE[currentDirection]];
  return [currentDirection, ...turns];
}

function sectorCorridorScore(candidate, initialDirection, origin) {
  const initial = VECTOR[initialDirection];
  const perpendicular = { x: -initial.y, y: initial.x };
  const dx = candidate.x - origin.x;
  const dy = candidate.y - origin.y;
  const outward = dx * initial.x + dy * initial.y;
  const lateral = Math.abs(dx * perpendicular.x + dy * perpendicular.y);
  // El sector es una guía para separar brazos, no una orden de prolongar una
  // recta hasta el borde. Una recompensa grande al progreso radial anulaba
  // los soft turns incluso cuando el giro abría un corredor mucho mejor.
  const corridorBalance = outward - lateral * 0.25;
  return Math.max(-900, Math.min(360, corridorBalance * 1.2));
}

function buildCandidateGeometry({
  rawTile,
  source,
  sourceFace,
  direction,
  currentDirection,
  connectionClearance,
  extraDistance = 0,
  turnLeadAdjustment = 0,
}) {
  const candidate = placeAfterFace(
    source,
    sourceFace,
    rawTile,
    direction,
    currentDirection,
    connectionClearance,
    extraDistance,
    turnLeadAdjustment,
  );
  const connectorStart = pointOutsideTraditionalTile(
    source,
    sourceFace,
    connectionClearance,
  );
  const connectorEnd = pointOutsideTraditionalTile(
    candidate,
    candidate.physicalStart,
    connectionClearance,
  );
  const connectorSegments = connectionSegments(
    connectorStart,
    connectorEnd,
    sourceFace,
  );
  return {
    tile: candidate,
    direction,
    connectorSegments,
    connectorLength: traditionalConnectorLength(connectorSegments),
  };
}

function immediateEscapeOptions(
  source,
  sourceFace,
  currentDirection,
  occupied,
  occupiedConnections,
  connectionClearance,
  isDouble = false,
) {
  let safeOptions = 0;
  for (const direction of candidateDirections(currentDirection, true)) {
    const leadAdjustments = direction === currentDirection
      ? [0]
      : TURN_LEAD_ADJUSTMENTS;
    for (const turnLeadAdjustment of leadAdjustments) {
      const geometry = buildCandidateGeometry({
        rawTile: createProbeTile(
          `${source.placementId}:${direction}:${isDouble ? "double" : "tile"}`,
          isDouble,
        ),
        source,
        sourceFace,
        direction,
        currentDirection,
        connectionClearance,
        turnLeadAdjustment,
      });
      if (connectorGeometryIsSafe(
        geometry.connectorSegments,
        source,
        geometry.tile,
        occupied,
        occupiedConnections,
      )) {
        safeOptions += 1;
        break;
      }
    }
  }
  return safeOptions;
}

function escapeDepthFromOpenFace(
  source,
  sourceFace,
  occupied,
  occupiedConnections,
  connectionClearance,
  isDouble = false,
) {
  const initialDirection = directionForSide(sourceFace.side);
  let bestDepth = 0;
  for (const direction of candidateDirections(initialDirection, true)) {
    const leadAdjustments = direction === initialDirection
      ? [0]
      : TURN_LEAD_ADJUSTMENTS;
    for (const turnLeadAdjustment of leadAdjustments) {
      const geometry = buildCandidateGeometry({
        rawTile: createProbeTile(
          `${source.placementId}:protected:${direction}`,
          isDouble,
        ),
        source,
        sourceFace,
        direction,
        currentDirection: initialDirection,
        connectionClearance,
        turnLeadAdjustment,
      });
      if (!connectorGeometryIsSafe(
        geometry.connectorSegments,
        source,
        geometry.tile,
        occupied,
        occupiedConnections,
      )) continue;
      const nextConnections = [
        ...occupiedConnections,
        {
          id: geometry.tile.placementId,
          firstPlacementId: source.placementId,
          secondPlacementId: geometry.tile.placementId,
          segments: geometry.connectorSegments,
        },
      ];
      const continuation = measureEscapeCapacity(
        geometry.tile,
        direction,
        initialDirection,
        [...occupied, geometry.tile],
        nextConnections,
        connectionClearance,
        2,
      );
      bestDepth = Math.max(bestDepth, 1 + continuation.depth);
      break;
    }
  }
  return bestDepth;
}

function measureEscapeCapacity(
  source,
  currentDirection,
  initialDirection,
  occupied,
  occupiedConnections,
  connectionClearance,
  depth = ESCAPE_LOOKAHEAD_STEPS,
) {
  if (depth <= 0) return { depth: 0, branches: 1 };
  let bestDepth = 0;
  let branches = 0;
  for (const direction of candidateDirections(currentDirection, true)) {
    const leadAdjustments = direction === currentDirection
      ? [0]
      : TURN_LEAD_ADJUSTMENTS;
    for (const turnLeadAdjustment of leadAdjustments) {
      const geometry = buildCandidateGeometry({
        rawTile: createProbeTile(
          `${source.placementId}:${depth}:${direction}`,
          depth % 2 === 0,
        ),
        source,
        sourceFace: source.physicalEnd,
        direction,
        currentDirection,
        connectionClearance,
        turnLeadAdjustment,
      });
      if (!connectorGeometryIsSafe(
        geometry.connectorSegments,
        source,
        geometry.tile,
        occupied,
        occupiedConnections,
      )) continue;
      const nextConnections = [
        ...occupiedConnections,
        {
          id: geometry.tile.placementId,
          firstPlacementId: source.placementId,
          secondPlacementId: geometry.tile.placementId,
          segments: geometry.connectorSegments,
        },
      ];
      const next = measureEscapeCapacity(
        geometry.tile,
        direction,
        initialDirection,
        [...occupied, geometry.tile],
        nextConnections,
        connectionClearance,
        depth - 1,
      );
      bestDepth = Math.max(bestDepth, 1 + next.depth);
      branches += 1 + next.branches;
      break;
    }
  }
  return { depth: bestDepth, branches };
}

function protectedExitHasJointContinuation(
  exit,
  protectedExits,
  occupied,
  occupiedConnections,
  connectionClearance,
  isDouble = false,
) {
  const currentDirection = directionForSide(exit.face.side);
  for (const direction of candidateDirections(currentDirection, true)) {
    const leadAdjustments = direction === currentDirection
      ? [0]
      : TURN_LEAD_ADJUSTMENTS;
    for (const turnLeadAdjustment of leadAdjustments) {
      const geometry = buildCandidateGeometry({
        rawTile: createProbeTile(
          `${exit.anchor.placementId}:joint:${direction}`,
          isDouble,
        ),
        source: exit.anchor,
        sourceFace: exit.face,
        direction,
        currentDirection,
        connectionClearance,
        turnLeadAdjustment,
      });
      if (!connectorGeometryIsSafe(
        geometry.connectorSegments,
        exit.anchor,
        geometry.tile,
        occupied,
        occupiedConnections,
      )) continue;
      const nextOccupied = [...occupied, geometry.tile];
      const nextConnections = [
        ...occupiedConnections,
        {
          id: geometry.tile.placementId,
          firstPlacementId: exit.anchor.placementId,
          secondPlacementId: geometry.tile.placementId,
          segments: geometry.connectorSegments,
        },
      ];
      const nextExit = {
        anchor: geometry.tile,
        face: geometry.tile.physicalEnd,
      };
      const remaining = protectedExits.filter(
        (candidate) =>
          candidate.anchor.placementId !== exit.anchor.placementId ||
          candidate.face.portId !== exit.face.portId,
      );
      const allStillUsable = [nextExit, ...remaining].every((candidate) =>
        candidate.requiresRamifierSpace
          ? ramifierFitsAtExit(
              candidate.anchor,
              candidate.face,
              nextOccupied,
              nextConnections,
              connectionClearance,
            )
          : candidate === nextExit
            ? escapeDepthFromOpenFace(
                candidate.anchor,
                candidate.face,
                nextOccupied,
                nextConnections,
                connectionClearance,
              ) >= 3
            : escapeDepthFromOpenFace(
                candidate.anchor,
                candidate.face,
                nextOccupied,
                nextConnections,
                connectionClearance,
              ) >= 3
      );
      if (allStillUsable) return true;
    }
  }
  return false;
}

function preservesProtectedExits(
  protectedExits,
  occupied,
  occupiedConnections,
  connectionClearance,
) {
  const allHaveCorridor = protectedExits.every((exit) => {
    if (exit.requiresRamifierSpace) {
      return ramifierFitsAtExit(
          exit.anchor,
          exit.face,
          occupied,
          occupiedConnections,
          connectionClearance,
        );
    }
    const ordinaryFits = exit.requiresJointContinuation
      ? escapeDepthFromOpenFace(
            exit.anchor,
            exit.face,
            occupied,
            occupiedConnections,
            connectionClearance,
          ) >= 3
      : immediateEscapeOptions(
            exit.anchor,
            exit.face,
            directionForSide(exit.face.side),
            occupied,
            occupiedConnections,
            connectionClearance,
          ) > 0;
    const doubleFits = immediateEscapeOptions(
      exit.anchor,
      exit.face,
      directionForSide(exit.face.side),
      occupied,
      occupiedConnections,
      connectionClearance,
      true,
    ) > 0;
    return ordinaryFits && doubleFits;
  });
  if (!allHaveCorridor) return false;
  return protectedExits
    .filter((exit) => !exit.requiresRamifierSpace)
    .every((exit) =>
      protectedExitHasJointContinuation(
        exit,
        protectedExits,
        occupied,
        occupiedConnections,
        connectionClearance,
      )
    );
}

function scoreCandidate(
  candidate,
  direction,
  currentDirection,
  initialDirection,
  occupied,
  envelopeTiles,
  center,
  sectorOrigin,
  straightRunLength,
  escapeCapacity,
) {
  const initialVector = VECTOR[initialDirection];
  const sectorProgress = (candidate.x - center.x) * initialVector.x +
    (candidate.y - center.y) * initialVector.y;
  const fitsNext = withinSoftBoard(candidate, center) &&
    (direction !== currentDirection || hasForwardRoom(candidate, direction, center));
  const isStraight = direction === currentDirection;
  const runPressure = Math.max(
    0,
    straightRunLength - (SOFT_TURN_RUN_START - 1),
  );
  const directionPreference = isStraight
    ? 520 - runPressure * 430
    : -180 + runPressure * 180;
  const prematureSoftTurnPenalty = !isStraight &&
      straightRunLength < SOFT_TURN_RUN_START
    ? (SOFT_TURN_RUN_START - straightRunLength) * 850
    : 0;
  return (fitsNext ? 10000 : 0) +
    directionPreference +
    futureRoomScore(candidate, direction, occupied, center) +
    escapeCapacity.depth * 2400 +
    Math.min(escapeCapacity.branches, 12) * 180 +
    sectorCorridorScore(candidate, initialDirection, sectorOrigin) +
    Math.max(-500, sectorProgress) -
    envelopeGrowth(candidate, envelopeTiles) * 6 -
    softBoundaryPressure(candidate, center) * 900 -
    prematureSoftTurnPenalty -
    (Math.abs(candidate.x - center.x) + Math.abs(candidate.y - center.y)) * 0.06;
}

function collectPlacementCandidates(
  tile,
  source,
  sourceFace,
  currentDirection,
  initialDirection,
  occupied,
  occupiedConnections,
  clockwiseFirst,
  connectionClearance,
  center = { x: 0, y: 0 },
  currentStraightRunLength = 0,
  {
    sectorOrigin = center,
    protectedExits = [],
  } = {},
) {
  const directions = candidateDirections(currentDirection, clockwiseFirst);
  const turns = directions.slice(1);
  const candidates = [];
  let straightFitsSoftBoard = false;
  for (
    let expansion = 0;
    expansion <= MAX_LOCAL_EXPANSION_STEPS;
    expansion += 1
  ) {
    for (const direction of directions) {
      const leadAdjustments = direction === currentDirection
        ? [0]
        : TURN_LEAD_ADJUSTMENTS;
      for (const turnLeadAdjustment of leadAdjustments) {
        const geometry = buildCandidateGeometry({
        rawTile: tile,
        source,
        sourceFace,
        direction,
        currentDirection,
        connectionClearance,
        extraDistance: expansion * TILE_GAP,
        turnLeadAdjustment,
        });
        const candidate = geometry.tile;
        const connectorSegments = geometry.connectorSegments;
        const connectorLength = geometry.connectorLength;
        if (!connectorGeometryIsSafe(
        connectorSegments,
        source,
        candidate,
        occupied,
        occupiedConnections,
        )) continue;
        const candidateConnection = {
        id: tile.start.connectionId ?? `${source.placementId}:${tile.placementId}`,
        firstPlacementId: source.placementId,
        secondPlacementId: tile.placementId,
        segments: connectorSegments,
        };
        const nextOccupied = [...occupied, candidate];
        const nextConnections = [...occupiedConnections, candidateConnection];
        const stillOpen = protectedExits.filter(
          ({ anchor, face }) =>
            anchor.placementId !== source.placementId ||
            face.portId !== sourceFace.portId,
        ).map((exit) => candidate.isSpecialDouble
          ? { ...exit, requiresRamifierSpace: false }
          : exit
        );
        // La nueva punta también pasa a formar parte del conjunto que debe
        // coexistir con todas las demás. Antes solo medíamos su corredor de
        // forma aislada: podía parecer profundo y, aun así, bloquear otra
        // punta en la jugada siguiente.
        stillOpen.push({
          anchor: candidate,
          face: candidate.physicalEnd,
          requiresJointContinuation: true,
        });
        if (candidate.isSpecialDouble) {
          for (const armIndex of [1, 2]) {
            const branchDirectionValue = branchDirection(candidate, armIndex);
            stillOpen.push({
              anchor: candidate,
            face: {
                portId: `branch:${armIndex}`,
                value: candidate.values[0],
              side: sidesFor(branchDirectionValue).end,
            },
            requiresJointContinuation: true,
          });
          }
        }
        const protectsOtherExits = preservesProtectedExits(
        stillOpen,
        nextOccupied,
        nextConnections,
        connectionClearance,
        );
        const escapeCapacity = measureEscapeCapacity(
        candidate,
        direction,
        initialDirection,
        nextOccupied,
        nextConnections,
        connectionClearance,
        );
        if (
        expansion === 0 &&
        direction === currentDirection &&
        withinSoftBoard(candidate, center) &&
        hasForwardRoom(candidate, direction, center)
        ) {
          straightFitsSoftBoard = true;
        }
        const escapePenalty = Math.max(
          0,
          ESCAPE_LOOKAHEAD_STEPS - escapeCapacity.depth,
        ) * 14000;
        const score = scoreCandidate(
        candidate,
        direction,
        currentDirection,
        initialDirection,
        occupied,
        occupied,
        center,
        sectorOrigin,
        currentStraightRunLength,
        escapeCapacity,
        ) + (direction === turns[0] ? 35 : 0) -
          expansion * 240 - connectorLength * 4 -
          escapePenalty -
          (protectsOtherExits ? 0 : PROTECTED_EXIT_PENALTY);
        const result = {
            tile: candidate,
            direction,
            score,
          connectorSegments,
          connectorLength,
            escapeCapacity,
            protectsOtherExits,
        };
        candidates.push(result);
      }
    }
  }
  const tier = (candidate) => {
    if (candidate.protectsOtherExits && candidate.escapeCapacity.depth >= 2) {
      return 2;
    }
    return candidate.protectsOtherExits ? 1 : 0;
  };
  return candidates
    .sort((first, second) =>
      tier(second) - tier(first) || second.score - first.score
    )
    .map((candidate) => {
      const turned = candidate.direction !== currentDirection;
      return {
        ...candidate,
        tile: {
          ...candidate.tile,
          straightRunLength: turned ? 1 : currentStraightRunLength + 1,
          turnReason: turned
            ? straightFitsSoftBoard ? "soft" : "hard"
            : "straight",
          escapeDepth: candidate.escapeCapacity.depth,
          protectedExitsPreserved: candidate.protectsOtherExits,
        },
      };
    });
}

function choosePlacement(...args) {
  const candidates = collectPlacementCandidates(...args);
  if (candidates.length === 0) {
    const tile = args[0];
    throw new Error(`No existe espacio visual limpio para ${tile.placementId}.`);
  }
  return candidates[0];
}

function placeChain(
  source,
  sourceFace,
  rawTiles,
  initialDirection,
  occupied,
  occupiedConnections,
  connectionClearance,
  {
    reverse = false,
    clockwiseFirst = true,
    center = { x: 0, y: 0 },
  } = {},
) {
  const tiles = [];
  let previous = source;
  let previousFace = sourceFace;
  let direction = initialDirection;
  let straightRunLength = source.direction === initialDirection
    ? source.straightRunLength ?? 1
    : 0;
  let turnCount = 0;
  for (const rawTile of rawTiles) {
    const tile = reverse ? reverseTile(rawTile) : rawTile;
    const chosen = choosePlacement(
      tile,
      previous,
      previousFace,
      direction,
      initialDirection,
      occupied,
      occupiedConnections,
      clockwiseFirst,
      connectionClearance,
      center,
      straightRunLength,
    );
    if (chosen.direction !== direction) turnCount += 1;
    direction = chosen.direction;
    straightRunLength = chosen.tile.straightRunLength;
    tiles.push(chosen.tile);
    occupied.push(chosen.tile);
    occupiedConnections.push({
      id: tile.start.connectionId ?? `${previous.placementId}:${tile.placementId}`,
      firstPlacementId: previous.placementId,
      secondPlacementId: tile.placementId,
      segments: chosen.connectorSegments,
    });
    previous = chosen.tile;
    previousFace = chosen.tile.physicalEnd;
  }
  return { tiles, direction, turnCount };
}

function faceForConnection(tile, connectionId) {
  if (tile.physicalStart.connectionId === connectionId) return tile.physicalStart;
  if (tile.physicalEnd.connectionId === connectionId) return tile.physicalEnd;
  throw new Error(
    `La ficha ${tile.placementId} no expone la conexión ${connectionId}.`,
  );
}

function faceForPort(tile, portId) {
  if (tile.physicalStart.portId === portId) return tile.physicalStart;
  if (tile.physicalEnd.portId === portId) return tile.physicalEnd;
  throw new Error(`La ficha ${tile.placementId} no expone el puerto ${portId}.`);
}

function connectionSegments(firstPoint, secondPoint, firstFace) {
  if (firstPoint.x === secondPoint.x || firstPoint.y === secondPoint.y) {
    return [{ ...firstPoint, x2: secondPoint.x, y2: secondPoint.y }];
  }
  const exitsHorizontally = firstFace.side === "left" ||
    firstFace.side === "right";
  const elbow = exitsHorizontally
    ? { x: secondPoint.x, y: firstPoint.y }
    : { x: firstPoint.x, y: secondPoint.y };
  return [
    { ...firstPoint, x2: elbow.x, y2: elbow.y },
    { x: elbow.x, y: elbow.y, x2: secondPoint.x, y2: secondPoint.y },
  ].filter((segment) => segment.x !== segment.x2 || segment.y !== segment.y2);
}

function createConnection(
  id,
  first,
  second,
  firstFace,
  secondFace,
  region,
  connectionClearance,
) {
  if (firstFace.value !== secondFace.value) {
    throw new Error(
      `La conexión visual ${id} enfrenta ${firstFace.value} con ${secondFace.value}.`,
    );
  }
  const firstPoint = pointOutsideTraditionalTile(
    first,
    firstFace,
    connectionClearance,
  );
  const secondPoint = pointOutsideTraditionalTile(
    second,
    secondFace,
    connectionClearance,
  );
  const segments = connectionSegments(firstPoint, secondPoint, firstFace).map(
    (segment, index) => ({
      ...segment,
      id: `${id}:segment:${index + 1}`,
      orientation: segment.y === segment.y2 ? "horizontal" : "vertical",
    }),
  );
  return {
    id,
    region,
    value: firstFace.value,
    firstFace: { ...firstFace },
    secondFace: { ...secondFace },
    firstPlacementId: first.placementId,
    secondPlacementId: second.placementId,
    x1: firstPoint.x,
    y1: firstPoint.y,
    x2: secondPoint.x,
    y2: secondPoint.y,
    orientation: segments.length === 1 ? segments[0].orientation : "elbow",
    segments,
  };
}

/**
 * Auditoría pura de la geometría ya proyectada. Sirve tanto para fixtures como
 * para impedir que un cambio futuro vuelva a aceptar cruces o enlaces largos.
 */
export function inspectTraditionalLayoutGeometry(
  layout,
  {
    connectorMargin = CONNECTOR_MARGIN,
    maxConnectorLength = MAX_CONNECTOR_LENGTH,
  } = {},
) {
  const edgeTileCrossings = [];
  const edgeEdgeCrossings = [];
  const overlyLongConnections = [];
  const tileOverlaps = [];
  const socketConflicts = [];
  const endpointMismatches = [];
  const nonFiniteGeometry = [];
  const connections = layout.connections ?? [];
  const tiles = layout.tiles ?? [];
  const tileByPlacementId = new Map(
    tiles.map((tile) => [tile.placementId, tile]),
  );

  tiles.forEach((first, index) => {
    for (const key of ["x", "y", "width", "height"]) {
      if (!Number.isFinite(first[key])) {
        nonFiniteGeometry.push({ placementId: first.placementId, key });
      }
    }
    tiles.slice(index + 1).forEach((second) => {
      if (traditionalBoundsOverlap(
        traditionalTileBounds(first),
        traditionalTileBounds(second),
      )) {
        tileOverlaps.push({
          firstPlacementId: first.placementId,
          secondPlacementId: second.placementId,
        });
      }
    });
  });

  for (const connection of connections) {
    for (const segment of connection.segments) {
      for (const key of ["x", "y", "x2", "y2"]) {
        if (!Number.isFinite(segment[key])) {
          nonFiniteGeometry.push({ connectionId: connection.id, key });
        }
      }
    }
    const length = traditionalConnectorLength(connection.segments);
    const expectedLimit = Math.min(
      maxConnectorLength,
      connectorLengthLimit(connection.segments),
    );
    if (length > expectedLimit) {
      overlyLongConnections.push({
        connectionId: connection.id,
        length,
        expectedLimit,
      });
    }
    const firstTile = tileByPlacementId.get(connection.firstPlacementId);
    const secondTile = tileByPlacementId.get(connection.secondPlacementId);
    const firstExpected = firstTile && pointOutsideTraditionalTile(
      firstTile,
      connection.firstFace,
      2,
    );
    const secondExpected = secondTile && pointOutsideTraditionalTile(
      secondTile,
      connection.secondFace,
      2,
    );
    if (
      !firstExpected || !secondExpected ||
      connection.x1 !== firstExpected.x || connection.y1 !== firstExpected.y ||
      connection.x2 !== secondExpected.x || connection.y2 !== secondExpected.y
    ) {
      endpointMismatches.push({ connectionId: connection.id });
    }
    for (const tile of tiles) {
      if (
        tile.placementId === connection.firstPlacementId ||
        tile.placementId === connection.secondPlacementId
      ) continue;
      if (connectorInvadesTile(connection.segments, tile, connectorMargin)) {
        edgeTileCrossings.push({
          connectionId: connection.id,
          placementId: tile.placementId,
        });
      }
    }
  }

  connections.forEach((first, index) => {
    connections.slice(index + 1).forEach((second) => {
      const conflicts = first.segments.some((firstSegment) =>
        second.segments.some((secondSegment) =>
          traditionalSegmentsConflict(
            firstSegment,
            secondSegment,
            connectorMargin,
          )
        )
      );
      if (conflicts) {
        edgeEdgeCrossings.push({
          firstConnectionId: first.id,
          secondConnectionId: second.id,
        });
      }
    });
  });

  for (const target of layout.openTargets ?? []) {
    for (const connection of connections) {
      if (
        connection.firstPlacementId === target.placementId ||
        connection.secondPlacementId === target.placementId
      ) continue;
      if (connection.segments.some((segment) => {
        const closestX = Math.max(
          Math.min(segment.x, segment.x2),
          Math.min(target.x, Math.max(segment.x, segment.x2)),
        );
        const closestY = Math.max(
          Math.min(segment.y, segment.y2),
          Math.min(target.y, Math.max(segment.y, segment.y2)),
        );
        return Math.hypot(target.x - closestX, target.y - closestY) <
          connectorMargin;
      })) {
        socketConflicts.push({
          connectionId: connection.id,
          targetId: target.id,
        });
      }
    }
  }

  return {
    edgeTileCrossings,
    edgeEdgeCrossings,
    overlyLongConnections,
    tileOverlaps,
    socketConflicts,
    endpointMismatches,
    nonFiniteGeometry,
    isValid:
      edgeTileCrossings.length === 0 &&
      edgeEdgeCrossings.length === 0 &&
      overlyLongConnections.length === 0 &&
      tileOverlaps.length === 0 &&
      socketConflicts.length === 0 &&
      endpointMismatches.length === 0 &&
      nonFiniteGeometry.length === 0,
  };
}

function initializeStableCanvas(tiles) {
  if (tiles.length === 0) {
    return {
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
      softCenter: { x: MIN_WIDTH / 2, y: MIN_HEIGHT / 2 },
    };
  }
  const left = Math.min(...tiles.map((tile) => traditionalTileBounds(tile).left));
  const top = Math.min(...tiles.map((tile) => traditionalTileBounds(tile).top));
  const shiftX = Math.max(STABLE_CANVAS_WIDTH / 2, TABLE_PADDING - left);
  const shiftY = Math.max(STABLE_CANVAS_HEIGHT / 2, TABLE_PADDING - top);
  for (const tile of tiles) {
    tile.x += shiftX;
    tile.y += shiftY;
  }
  return expandStableCanvas(tiles, {
    width: STABLE_CANVAS_WIDTH,
    height: STABLE_CANVAS_HEIGHT,
    softCenter: { x: shiftX, y: shiftY },
  });
}

function expandStableCanvas(tiles, previousSize) {
  if (tiles.length === 0) return previousSize;
  const right = Math.max(...tiles.map((tile) => traditionalTileBounds(tile).right));
  const bottom = Math.max(...tiles.map((tile) => traditionalTileBounds(tile).bottom));
  return {
    width: Math.max(previousSize.width, right + TABLE_PADDING),
    height: Math.max(previousSize.height, bottom + TABLE_PADDING),
    softCenter: { ...previousSize.softCenter },
  };
}

function directionForSide(side) {
  switch (side) {
    case "left": return "left";
    case "right": return "right";
    case "top": return "up";
    case "bottom": return "down";
    default: throw new TypeError(`Cara tradicional desconocida: ${side}.`);
  }
}

function initialDirectionForOpenTarget(layout, target, face) {
  if (target.topology.region === "branch") {
    const family = layout.branchFamilies.find(
      (candidate) => candidate.id === target.topology.familyId,
    );
    const arm = family?.arms.find(
      (candidate) => candidate.armIndex === target.topology.armIndex,
    );
    return arm?.direction ?? directionForSide(face.side);
  }
  const first = layout.mainTiles[0];
  if (
    first?.placementId === target.placementId &&
    first.physicalStart.portId === target.portId
  ) {
    return "left";
  }
  return "right";
}

/**
 * Previsualiza una única jugada física con la misma elección local usada al
 * crecer la mesa. No simula reglas: recibe exclusivamente un target ya legal.
 */
export function previewTraditionalPlacement(
  layout,
  target,
  domino,
  { connectionClearance = 2 } = {},
) {
  const openFace = layout.openFacesByTargetId.get(target.id);
  if (!openFace || !domino) return null;
  const otherValue = domino.a === target.value ? domino.b : domino.a;
  const rawTile = {
    placementId: `ghost:${target.id}`,
    dominoId: domino.dominoId,
    values: [target.value, otherValue],
    isDouble: domino.a === domino.b,
    isSpecialDouble: false,
    doubleRole: domino.a === domino.b ? "ORDINARY_DOUBLE" : null,
    region: target.topology.region,
    start: {
      portId: "ghost:start",
      value: target.value,
      connectionId: null,
      neighborPlacementId: target.placementId,
    },
    end: {
      portId: "ghost:end",
      value: otherValue,
      connectionId: null,
      neighborPlacementId: null,
    },
  };
  const currentDirection = directionForSide(openFace.face.side);
  const chosen = choosePlacement(
    rawTile,
    openFace.anchor,
    openFace.face,
    currentDirection,
    initialDirectionForOpenTarget(layout, target, openFace.face),
    layout.tiles,
    flattenLayoutConnections(layout.connections),
    true,
    connectionClearance,
    layout.softCenter,
    openFace.anchor.direction === currentDirection
      ? openFace.anchor.straightRunLength ?? 1
      : 0,
  );
  return {
    ...chosen.tile,
    id: target.id,
    target: {
      kind: "OPEN_END",
      placementId: target.placementId,
      portId: target.portId,
    },
    a: chosen.tile.firstValue,
    b: chosen.tile.secondValue,
  };
}

function branchDirection(root, armIndex) {
  if (isHorizontal(root.direction)) return armIndex === 1 ? "up" : "down";
  return armIndex === 1 ? "left" : "right";
}

function rawTilesByPlacementId(table) {
  return new Map([
    ...table.mainLine.tiles,
    ...table.branchFamilies.flatMap((family) =>
      family.arms.flatMap((arm) => arm.tiles)
    ),
  ].map((tile) => [tile.placementId, tile]));
}

function sameTileIdentity(first, second) {
  return first?.placementId === second?.placementId &&
    first?.dominoId === second?.dominoId &&
    first?.values?.[0] === second?.values?.[0] &&
    first?.values?.[1] === second?.values?.[1];
}

function canExtendLayout(table, previousLayout) {
  if (!previousLayout?.tiles || !previousLayout.softCenter) return false;
  const current = rawTilesByPlacementId(table);
  if (current.size < previousLayout.tiles.length ||
      current.size > previousLayout.tiles.length + 1) {
    return false;
  }
  return previousLayout.tiles.every((tile) =>
    sameTileIdentity(tile, current.get(tile.placementId))
  );
}

function createRootFaces(table, tileByPlacementId) {
  const rootFacesByArmId = new Map();
  for (const family of table.branchFamilies) {
    const root = tileByPlacementId.get(family.rootPlacementId);
    if (!root) continue;
    for (const arm of family.arms) {
      const direction = branchDirection(root, arm.armIndex);
      rootFacesByArmId.set(arm.id, {
        ...arm.origin,
        side: sidesFor(direction).end,
      });
    }
  }
  return rootFacesByArmId;
}

function contentExceedsSoftBoard(tiles, center) {
  return tiles.some((tile) => !withinSoftBoard(tile, center));
}

function measureContent(tiles, softCenter) {
  if (tiles.length === 0) {
    return {
      left: softCenter.x - MIN_WIDTH / 2,
      right: softCenter.x + MIN_WIDTH / 2,
      top: softCenter.y - MIN_HEIGHT / 2,
      bottom: softCenter.y + MIN_HEIGHT / 2,
      width: MIN_WIDTH,
      height: MIN_HEIGHT,
      centerX: softCenter.x,
      centerY: softCenter.y,
    };
  }
  const left = Math.min(...tiles.map((tile) => traditionalTileBounds(tile).left)) -
    TABLE_PADDING;
  const right = Math.max(...tiles.map((tile) => traditionalTileBounds(tile).right)) +
    TABLE_PADDING;
  const top = Math.min(...tiles.map((tile) => traditionalTileBounds(tile).top)) -
    TABLE_PADDING;
  const bottom = Math.max(...tiles.map((tile) => traditionalTileBounds(tile).bottom)) +
    TABLE_PADDING;
  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

function assembleLayout(
  table,
  tileByPlacementId,
  size,
  turnCount,
  connectionClearance,
) {
  const rawMain = table.mainLine.tiles;
  const rootFacesByArmId = createRootFaces(table, tileByPlacementId);
  const mainTiles = rawMain.map((tile) => tileByPlacementId.get(tile.placementId));
  const branchFamilies = table.branchFamilies.map((family) => ({
    ...family,
    root: tileByPlacementId.get(family.rootPlacementId),
    arms: family.arms.map((arm) => {
      const rootFace = rootFacesByArmId.get(arm.id);
      return {
        ...arm,
        direction: directionForSide(rootFace.side),
        rootFace,
        tiles: arm.tiles.map((tile) => tileByPlacementId.get(tile.placementId)),
      };
    }),
  }));
  const connections = [];

  mainTiles.slice(0, -1).forEach((tile, index) => {
    const connectionId = table.mainLine.connectionIds[index];
    const next = mainTiles[index + 1];
    connections.push(createConnection(
      connectionId,
      tile,
      next,
      faceForConnection(tile, connectionId),
      faceForConnection(next, connectionId),
      "main",
      connectionClearance,
    ));
  });

  for (const family of branchFamilies) {
    for (const arm of family.arms) {
      arm.connectionIds.forEach((connectionId, index) => {
        const first = index === 0 ? family.root : arm.tiles[index - 1];
        const second = arm.tiles[index];
        connections.push(createConnection(
          connectionId,
          first,
          second,
          index === 0 ? arm.rootFace : faceForConnection(first, connectionId),
          faceForConnection(second, connectionId),
          "branch",
          connectionClearance,
        ));
      });
    }
  }

  const openFacesByTargetId = new Map();
  for (const target of table.openTargets) {
    const anchor = tileByPlacementId.get(target.placementId);
    if (!anchor) continue;
    let face;
    if (target.topology.branchState === "POTENTIAL") {
      const family = branchFamilies.find(
        (candidate) => candidate.id === target.topology.familyId,
      );
      face = family?.arms.find(
        (candidate) => candidate.armIndex === target.topology.armIndex,
      )?.rootFace;
    } else {
      face = faceForPort(anchor, target.portId);
    }
    if (face) openFacesByTargetId.set(target.id, { anchor, face });
  }

  const tiles = [...tileByPlacementId.values()];
  const specialIndex = rawMain.findIndex((tile) => tile.isSpecialDouble);
  const softTurnCount = tiles.filter(
    (tile) => tile.turnReason === "soft",
  ).length;
  const hardTurnCount = tiles.filter(
    (tile) => tile.turnReason === "hard",
  ).length;
  return {
    ...size,
    contentBounds: measureContent(tiles, size.softCenter),
    mainTiles,
    branchFamilies,
    tiles,
    connections,
    openFacesByTargetId,
    layoutStats: {
      strategy: specialIndex >= 0 ? "four-arm-snake" : "linear-snake",
      incremental: true,
      turnCount,
      softTurnCount,
      hardTurnCount,
      collisionMargin: COLLISION_MARGIN,
      expandedCanvas: contentExceedsSoftBoard(tiles, size.softCenter),
    },
  };
}

function placementSequence(tile) {
  if (Number.isInteger(tile.sequence)) return tile.sequence;
  const parsed = Number.parseInt(tile.placementId.split("-").at(-1), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function orderedRawTiles(table) {
  return [...rawTilesByPlacementId(table).values()].sort(
    (first, second) => placementSequence(first) - placementSequence(second),
  );
}

function collectProtectedReplayExits(
  table,
  rawByPlacementId,
  tileByPlacementId,
) {
  const protectedById = new Map();
  const requiresRamifierSpace = table.structuralMode === "RAMIFICADO" &&
    ![...tileByPlacementId.values()].some((tile) => tile.isSpecialDouble);
  for (const tile of tileByPlacementId.values()) {
    const raw = rawByPlacementId.get(tile.placementId);
    for (const face of [tile.physicalStart, tile.physicalEnd]) {
      const rawFace = raw.start.portId === face.portId ? raw.start : raw.end;
      if (
        rawFace.neighborPlacementId === null ||
        !tileByPlacementId.has(rawFace.neighborPlacementId)
      ) {
        protectedById.set(`${tile.placementId}:${face.portId}`, {
          anchor: tile,
          face,
          requiresRamifierSpace,
        });
      }
    }
  }
  for (const family of table.branchFamilies) {
    const root = tileByPlacementId.get(family.rootPlacementId);
    if (!root) continue;
    for (const arm of family.arms) {
      const firstPlacementId = arm.tiles[0]?.placementId ?? null;
      if (firstPlacementId !== null && tileByPlacementId.has(firstPlacementId)) {
        continue;
      }
      const direction = branchDirection(root, arm.armIndex);
      const face = { ...arm.origin, side: sidesFor(direction).end };
      protectedById.set(`${root.placementId}:${face.portId}`, {
        anchor: root,
        face,
      });
    }
  }
  return [...protectedById.values()];
}

function routeForHistoricalTile(
  table,
  rawTile,
  openingPlacementId,
  tileByPlacementId,
) {
  if (rawTile.region === "branch") {
    const family = table.branchFamilies.find(
      (candidate) => candidate.id === rawTile.familyId,
    );
    const root = tileByPlacementId.get(family.rootPlacementId);
    const arm = family.arms.find(
      (candidate) => candidate.armIndex === rawTile.armIndex,
    );
    const initialDirection = branchDirection(root, rawTile.armIndex);
    return {
      initialDirection,
      sectorOrigin: { x: root.x, y: root.y },
      rootFace: arm?.tiles[0]?.placementId === rawTile.placementId
        ? { ...arm.origin, side: sidesFor(initialDirection).end }
        : null,
    };
  }
  const mainIds = table.mainLine.placementIds;
  const openingIndex = mainIds.indexOf(openingPlacementId);
  const tileIndex = mainIds.indexOf(rawTile.placementId);
  const opening = tileByPlacementId.get(openingPlacementId);
  return {
    initialDirection: tileIndex < openingIndex ? "left" : "right",
    sectorOrigin: { x: opening.x, y: opening.y },
  };
}

/**
 * Reconstrucción determinista por orden histórico. Al volver desde otra vista
 * no depende de cuántas jugadas observó el renderer: reproduce las mismas
 * decisiones locales desde el snapshot público.
 */
function createInitialLayout(table, connectionClearance) {
  const ordered = orderedRawTiles(table);
  const occupied = [];
  const occupiedConnections = [];
  const tileByPlacementId = new Map();
  let turnCount = 0;
  let exploredCandidates = 0;
  const reconstructionBudget = Math.max(1200, ordered.length * 180);

  if (ordered.length > 0) {
    const openingRaw = ordered[0];
    const opening = {
      ...projectTile(openingRaw, 0, 0, "right"),
      straightRunLength: 1,
      turnReason: "origin",
    };
    occupied.push(opening);
    tileByPlacementId.set(opening.placementId, opening);
    const rawByPlacementId = rawTilesByPlacementId(table);

    const replay = (historyIndex, accumulatedTurns) => {
      if (historyIndex >= ordered.length) return accumulatedTurns;
      if (exploredCandidates >= reconstructionBudget) return null;
      const rawTile = ordered[historyIndex];
      const startIsConnected = rawTile.start.neighborPlacementId !== null &&
        tileByPlacementId.has(rawTile.start.neighborPlacementId);
      const endIsConnected = rawTile.end.neighborPlacementId !== null &&
        tileByPlacementId.has(rawTile.end.neighborPlacementId);
      if (startIsConnected === endIsConnected) {
        throw new Error(
          `No se pudo reconstruir el enlace histórico de ${rawTile.placementId}.`,
        );
      }
      const oriented = startIsConnected ? rawTile : reverseTile(rawTile);
      const source = tileByPlacementId.get(oriented.start.neighborPlacementId);
      const route = routeForHistoricalTile(
        table,
        rawTile,
        opening.placementId,
        tileByPlacementId,
      );
      const sourceFace = route.rootFace ?? faceForConnection(
        source,
        oriented.start.connectionId,
      );
      const currentDirection = directionForSide(sourceFace.side);
      const protectedExits = collectProtectedReplayExits(
        table,
        rawByPlacementId,
        tileByPlacementId,
      );
      const candidates = collectPlacementCandidates(
        oriented,
        source,
        sourceFace,
        currentDirection,
        route.initialDirection,
        occupied,
        occupiedConnections,
        true,
        connectionClearance,
        { x: 0, y: 0 },
        source.direction === currentDirection
          ? source.straightRunLength ?? 1
          : 0,
        {
          sectorOrigin: route.sectorOrigin,
          protectedExits,
        },
      );
      for (const chosen of candidates) {
        exploredCandidates += 1;
        if (exploredCandidates > reconstructionBudget) break;
        const connection = {
          id: oriented.start.connectionId,
          firstPlacementId: source.placementId,
          secondPlacementId: chosen.tile.placementId,
          segments: chosen.connectorSegments,
        };
        occupied.push(chosen.tile);
        tileByPlacementId.set(chosen.tile.placementId, chosen.tile);
        occupiedConnections.push(connection);
        const result = replay(
          historyIndex + 1,
          accumulatedTurns + Number(chosen.direction !== currentDirection),
        );
        if (result !== null) return result;
        occupiedConnections.pop();
        tileByPlacementId.delete(chosen.tile.placementId);
        occupied.pop();
      }
      return null;
    };

    const replayedTurns = replay(1, 0);
    if (replayedTurns === null) {
      return createGuaranteedRadialLayout(table, connectionClearance);
    }
    turnCount = replayedTurns;
  }

  const size = initializeStableCanvas([...tileByPlacementId.values()]);
  return assembleLayout(
    table,
    tileByPlacementId,
    size,
    turnCount,
    connectionClearance,
  );
}

function orientFromSource(rawTile, sourcePlacementId) {
  if (rawTile.start.neighborPlacementId === sourcePlacementId) return rawTile;
  if (rawTile.end.neighborPlacementId === sourcePlacementId) {
    return reverseTile(rawTile);
  }
  throw new Error(
    `La ficha ${rawTile.placementId} no continúa desde ${sourcePlacementId}.`,
  );
}

function placeGuaranteedArm({
  rawTiles,
  root,
  direction,
  tileByPlacementId,
  connectionClearance,
  rootFace = null,
}) {
  let source = root;
  let face = rootFace;
  for (const rawTile of rawTiles) {
    const oriented = orientFromSource(rawTile, source.placementId);
    const sourceFace = face ?? faceForConnection(
      source,
      oriented.start.connectionId,
    );
    const placed = {
      ...placeAfterFace(
        source,
        sourceFace,
        oriented,
        direction,
        direction,
        connectionClearance,
      ),
      straightRunLength: (source.straightRunLength ?? 0) + 1,
      turnReason: "straight",
      escapeDepth: ESCAPE_LOOKAHEAD_STEPS,
      protectedExitsPreserved: true,
    };
    tileByPlacementId.set(placed.placementId, placed);
    source = placed;
    face = null;
  }
}

function centerCanvasOnPlacement(tiles, placementId) {
  const anchor = tiles.find((tile) => tile.placementId === placementId);
  if (!anchor) return initializeStableCanvas(tiles);
  const offsetX = -anchor.x;
  const offsetY = -anchor.y;
  for (const tile of tiles) {
    tile.x += offsetX;
    tile.y += offsetY;
  }
  const relative = compactBounds(tiles);
  const halfWidth = Math.max(
    STABLE_CANVAS_WIDTH / 2,
    Math.abs(relative.left) + TABLE_PADDING,
    Math.abs(relative.right) + TABLE_PADDING,
  );
  const halfHeight = Math.max(
    STABLE_CANVAS_HEIGHT / 2,
    Math.abs(relative.top) + TABLE_PADDING,
    Math.abs(relative.bottom) + TABLE_PADDING,
  );
  const softCenter = { x: halfWidth, y: halfHeight };
  for (const tile of tiles) {
    tile.x += softCenter.x;
    tile.y += softCenter.y;
  }
  return {
    width: halfWidth * 2,
    height: halfHeight * 2,
    softCenter,
  };
}

/**
 * Reconstrucción total de último recurso. La topología reglamentaria es una
 * unión de hasta cuatro caminos simples; asignar un rayo diferente a cada
 * camino garantiza conectores físicos cortos y ausencia de cruces.
 */
function createGuaranteedRadialLayout(table, connectionClearance) {
  const rawByPlacementId = rawTilesByPlacementId(table);
  const ordered = orderedRawTiles(table);
  const special = ordered.find((tile) => tile.isSpecialDouble) ?? null;
  const anchorRaw = special ?? ordered[0] ?? null;
  const tileByPlacementId = new Map();
  if (!anchorRaw) {
    return assembleLayout(
      table,
      tileByPlacementId,
      initializeStableCanvas([]),
      0,
      connectionClearance,
    );
  }
  const anchor = {
    ...projectTile(anchorRaw, 0, 0, "right"),
    straightRunLength: 1,
    turnReason: "origin",
    escapeDepth: ESCAPE_LOOKAHEAD_STEPS,
    protectedExitsPreserved: true,
  };
  tileByPlacementId.set(anchor.placementId, anchor);

  const mainIds = table.mainLine.placementIds;
  const anchorIndex = mainIds.indexOf(anchor.placementId);
  const leftTiles = mainIds.slice(0, anchorIndex).reverse().map(
    (placementId) => rawByPlacementId.get(placementId),
  );
  const rightTiles = mainIds.slice(anchorIndex + 1).map(
    (placementId) => rawByPlacementId.get(placementId),
  );
  placeGuaranteedArm({
    rawTiles: leftTiles,
    root: anchor,
    direction: "left",
    tileByPlacementId,
    connectionClearance,
  });
  placeGuaranteedArm({
    rawTiles: rightTiles,
    root: anchor,
    direction: "right",
    tileByPlacementId,
    connectionClearance,
  });

  const family = table.branchFamilies.find(
    (candidate) => candidate.rootPlacementId === anchor.placementId,
  );
  for (const arm of family?.arms ?? []) {
    const direction = arm.armIndex === 1 ? "up" : "down";
    placeGuaranteedArm({
      rawTiles: arm.tiles.map(
        ({ placementId }) => rawByPlacementId.get(placementId),
      ),
      root: anchor,
      direction,
      tileByPlacementId,
      connectionClearance,
      rootFace: { ...arm.origin, side: sidesFor(direction).end },
    });
  }

  const tiles = [...tileByPlacementId.values()];
  const layout = assembleLayout(
    table,
    tileByPlacementId,
    centerCanvasOnPlacement(tiles, ordered[0].placementId),
    0,
    connectionClearance,
  );
  layout.layoutStats.reconstructedRadially = true;
  return layout;
}

function locateNewTile(table, newPlacementId, tileByPlacementId) {
  const rawMain = table.mainLine.tiles;
  const mainIndex = rawMain.findIndex(
    (tile) => tile.placementId === newPlacementId,
  );
  if (mainIndex >= 0) {
    if (mainIndex === 0 && rawMain.length > 1) {
      const sourceRaw = rawMain[1];
      return {
        rawTile: reverseTile(rawMain[0]),
        source: tileByPlacementId.get(sourceRaw.placementId),
        connectionId: table.mainLine.connectionIds[0],
        initialDirection: "left",
      };
    }
    if (mainIndex === rawMain.length - 1 && mainIndex > 0) {
      const sourceRaw = rawMain[mainIndex - 1];
      return {
        rawTile: rawMain[mainIndex],
        source: tileByPlacementId.get(sourceRaw.placementId),
        connectionId: table.mainLine.connectionIds[mainIndex - 1],
        initialDirection: "right",
      };
    }
    return null;
  }

  for (const family of table.branchFamilies) {
    const root = tileByPlacementId.get(family.rootPlacementId);
    for (const arm of family.arms) {
      const index = arm.tiles.findIndex(
        (tile) => tile.placementId === newPlacementId,
      );
      if (index < 0 || index !== arm.tiles.length - 1) continue;
      return {
        rawTile: arm.tiles[index],
        source: index === 0
          ? root
          : tileByPlacementId.get(arm.tiles[index - 1].placementId),
        connectionId: arm.connectionIds[index],
        initialDirection: branchDirection(root, arm.armIndex),
        rootFace: index === 0
          ? {
              ...arm.origin,
              side: sidesFor(branchDirection(root, arm.armIndex)).end,
            }
          : null,
      };
    }
  }
  return null;
}

function extendLayout(table, previousLayout, connectionClearance) {
  const currentRawTiles = rawTilesByPlacementId(table);
  const tileByPlacementId = new Map(previousLayout.tiles.map((tile) => {
    const refreshed = refreshProjectedTile(
      tile,
      currentRawTiles.get(tile.placementId),
    );
    return [refreshed.placementId, refreshed];
  }));
  let turnCount = previousLayout.layoutStats.turnCount;

  if (currentRawTiles.size > tileByPlacementId.size) {
    const newPlacementId = [...currentRawTiles.keys()].find(
      (placementId) => !tileByPlacementId.has(placementId),
    );
    const extension = locateNewTile(table, newPlacementId, tileByPlacementId);
    if (!extension?.source) return null;
    const sourceFace = extension.rootFace ??
      faceForConnection(extension.source, extension.connectionId);
    const currentDirection = directionForSide(sourceFace.side);
    const openingPlacementId = orderedRawTiles(table)[0]?.placementId;
    const route = routeForHistoricalTile(
      table,
      extension.rawTile,
      openingPlacementId,
      tileByPlacementId,
    );
    const protectedExits = collectProtectedReplayExits(
      table,
      currentRawTiles,
      tileByPlacementId,
    );
    const chosen = choosePlacement(
      extension.rawTile,
      extension.source,
      sourceFace,
      currentDirection,
      route.initialDirection,
      [...tileByPlacementId.values()],
      flattenLayoutConnections(previousLayout.connections),
      true,
      connectionClearance,
      previousLayout.softCenter,
      extension.source.direction === currentDirection
        ? extension.source.straightRunLength ?? 1
        : 0,
      {
        sectorOrigin: route.sectorOrigin,
        protectedExits,
      },
    );
    if (chosen.direction !== currentDirection) turnCount += 1;
    tileByPlacementId.set(newPlacementId, chosen.tile);
  }

  const size = expandStableCanvas(
    [...tileByPlacementId.values()],
    previousLayout,
  );
  return assembleLayout(
    table,
    tileByPlacementId,
    size,
    turnCount,
    connectionClearance,
  );
}

/**
 * Geometría visual descartable. `previousLayout` permite crecer una sola ficha
 * sin recolocar ni reorientar las ya vistas durante la sesión.
 */
export function createTraditionalSnakeLayout(
  table,
  { connectionClearance = 2, previousLayout = null } = {},
) {
  if (canExtendLayout(table, previousLayout)) {
    try {
      const extended = extendLayout(table, previousLayout, connectionClearance);
      if (extended) return extended;
    } catch {
      // Una geometría incremental antigua puede haber reservado un corredor
      // diferente al requerido por una jugada posterior hecha en otra vista.
      // El snapshot reglamentario sigue siendo representable: se reconstruye
      // de forma determinista y nunca se deja el tablero vacío.
    }
  }
  return createInitialLayout(table, connectionClearance);
}
