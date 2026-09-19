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
const LOOKAHEAD_STEPS = 3;

export const TRADITIONAL_COLLISION_MARGIN = COLLISION_MARGIN;
export const TRADITIONAL_TILE_LONG = TILE_LONG;
export const TRADITIONAL_TILE_SHORT = TILE_SHORT;

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
  return projectTile(oriented, tile.x, tile.y, tile.direction);
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
    const firstLeg = TURN_LEG + extraDistance;
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

function scoreCandidate(
  candidate,
  direction,
  currentDirection,
  initialDirection,
  occupied,
  center,
) {
  const initialVector = VECTOR[initialDirection];
  const sectorProgress = (candidate.x - center.x) * initialVector.x +
    (candidate.y - center.y) * initialVector.y;
  const fitsNext = withinSoftBoard(candidate, center) &&
    (direction !== currentDirection || hasForwardRoom(candidate, direction, center));
  return (fitsNext ? 10000 : 0) +
    (direction === currentDirection ? 500 : 0) +
    futureRoomScore(candidate, direction, occupied, center) +
    Math.max(-500, sectorProgress) -
    (Math.abs(candidate.x - center.x) + Math.abs(candidate.y - center.y)) * 0.02;
}

function choosePlacement(
  tile,
  source,
  sourceFace,
  currentDirection,
  initialDirection,
  occupied,
  clockwiseFirst,
  connectionClearance,
  center = { x: 0, y: 0 },
) {
  const turns = clockwiseFirst
    ? [CLOCKWISE[currentDirection], COUNTERCLOCKWISE[currentDirection]]
    : [COUNTERCLOCKWISE[currentDirection], CLOCKWISE[currentDirection]];
  const directions = [currentDirection, ...turns];
  let best = null;
  for (let expansion = 0; expansion <= 5; expansion += 1) {
    for (const direction of directions) {
      const candidate = placeAfterFace(
        source,
        sourceFace,
        tile,
        direction,
        currentDirection,
        connectionClearance,
        expansion * (TILE_LONG + TILE_GAP),
      );
      const obstacles = occupied.filter(
        (occupiedTile) => occupiedTile.placementId !== source.placementId,
      );
      if (collides(candidate, obstacles)) continue;
      const score = scoreCandidate(
        candidate,
        direction,
        currentDirection,
        initialDirection,
        obstacles,
        center,
      ) + (direction === turns[0] ? 200 : 0) - expansion * 200;
      if (!best || score > best.score) {
        best = { tile: candidate, direction, score };
      }
    }
    if (best?.score >= 10000) break;
  }
  if (!best) {
    throw new Error(`No existe espacio visual limpio para ${tile.placementId}.`);
  }
  return best;
}

function placeChain(
  source,
  sourceFace,
  rawTiles,
  initialDirection,
  occupied,
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
      clockwiseFirst,
      connectionClearance,
      center,
    );
    if (chosen.direction !== direction) turnCount += 1;
    direction = chosen.direction;
    tiles.push(chosen.tile);
    occupied.push(chosen.tile);
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
    true,
    connectionClearance,
    layout.softCenter,
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
      collisionMargin: COLLISION_MARGIN,
      expandedCanvas: contentExceedsSoftBoard(tiles, size.softCenter),
    },
  };
}

function createInitialLayout(table, connectionClearance) {
  const rawMain = table.mainLine.tiles;
  const specialIndex = rawMain.findIndex((tile) => tile.isSpecialDouble);
  const occupied = [];
  const tileByPlacementId = new Map();
  let turnCount = 0;

  if (rawMain.length > 0 && specialIndex >= 0) {
    const root = projectTile(rawMain[specialIndex], 0, 0, "right");
    occupied.push(root);
    tileByPlacementId.set(root.placementId, root);
    const left = placeChain(
      root,
      root.physicalStart,
      rawMain.slice(0, specialIndex).reverse(),
      "left",
      occupied,
      connectionClearance,
      { reverse: true, clockwiseFirst: true },
    );
    const right = placeChain(
      root,
      root.physicalEnd,
      rawMain.slice(specialIndex + 1),
      "right",
      occupied,
      connectionClearance,
      { clockwiseFirst: true },
    );
    turnCount += left.turnCount + right.turnCount;
    [...left.tiles, ...right.tiles].forEach((tile) =>
      tileByPlacementId.set(tile.placementId, tile)
    );

    for (const family of table.branchFamilies) {
      const familyRoot = tileByPlacementId.get(family.rootPlacementId);
      for (const arm of family.arms) {
        const initialDirection = branchDirection(familyRoot, arm.armIndex);
        const rootFace = {
          ...arm.origin,
          side: sidesFor(initialDirection).end,
        };
        const placed = placeChain(
          familyRoot,
          rootFace,
          arm.tiles,
          initialDirection,
          occupied,
          connectionClearance,
          { clockwiseFirst: true },
        );
        turnCount += placed.turnCount;
        placed.tiles.forEach((tile) =>
          tileByPlacementId.set(tile.placementId, tile)
        );
      }
    }
  } else if (rawMain.length > 0) {
    const first = projectTile(rawMain[0], 0, 0, "right");
    occupied.push(first);
    tileByPlacementId.set(first.placementId, first);
    const rest = placeChain(
      first,
      first.physicalEnd,
      rawMain.slice(1),
      "right",
      occupied,
      connectionClearance,
      { clockwiseFirst: true },
    );
    turnCount += rest.turnCount;
    rest.tiles.forEach((tile) =>
      tileByPlacementId.set(tile.placementId, tile)
    );
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
    const chosen = choosePlacement(
      extension.rawTile,
      extension.source,
      sourceFace,
      currentDirection,
      extension.initialDirection,
      [...tileByPlacementId.values()],
      true,
      connectionClearance,
      previousLayout.softCenter,
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
    const extended = extendLayout(table, previousLayout, connectionClearance);
    if (extended) return extended;
  }
  return createInitialLayout(table, connectionClearance);
}
