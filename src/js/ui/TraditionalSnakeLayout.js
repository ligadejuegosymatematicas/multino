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

export const TRADITIONAL_COLLISION_MARGIN = COLLISION_MARGIN;

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

function withinSoftBoard(tile) {
  const bounds = traditionalTileBounds(tile);
  return bounds.left >= -SOFT_HALF_WIDTH &&
    bounds.right <= SOFT_HALF_WIDTH &&
    bounds.top >= -SOFT_HALF_HEIGHT &&
    bounds.bottom <= SOFT_HALF_HEIGHT;
}

function hasForwardRoom(tile, direction) {
  const bounds = traditionalTileBounds(tile);
  const reserve = TILE_LONG + TILE_GAP + COLLISION_MARGIN;
  switch (direction) {
    case "right": return bounds.right + reserve <= SOFT_HALF_WIDTH;
    case "left": return bounds.left - reserve >= -SOFT_HALF_WIDTH;
    case "down": return bounds.bottom + reserve <= SOFT_HALF_HEIGHT;
    case "up": return bounds.top - reserve >= -SOFT_HALF_HEIGHT;
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

function scoreCandidate(candidate, direction, currentDirection, initialDirection) {
  const initialVector = VECTOR[initialDirection];
  const sectorProgress = candidate.x * initialVector.x +
    candidate.y * initialVector.y;
  const fitsNext = withinSoftBoard(candidate) &&
    (direction !== currentDirection || hasForwardRoom(candidate, direction));
  return (fitsNext ? 10000 : 0) +
    (direction === currentDirection ? 500 : 0) +
    Math.max(-500, sectorProgress) -
    (Math.abs(candidate.x) + Math.abs(candidate.y)) * 0.02;
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
  { reverse = false, clockwiseFirst = true } = {},
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

function normalizeTiles(tiles) {
  if (tiles.length === 0) {
    return { width: MIN_WIDTH, height: MIN_HEIGHT };
  }
  const left = Math.min(...tiles.map((tile) => traditionalTileBounds(tile).left));
  const right = Math.max(...tiles.map((tile) => traditionalTileBounds(tile).right));
  const top = Math.min(...tiles.map((tile) => traditionalTileBounds(tile).top));
  const bottom = Math.max(...tiles.map((tile) => traditionalTileBounds(tile).bottom));
  const shiftX = TABLE_PADDING - left;
  const shiftY = TABLE_PADDING - top;
  for (const tile of tiles) {
    tile.x += shiftX;
    tile.y += shiftY;
  }
  return {
    width: Math.max(MIN_WIDTH, right - left + TABLE_PADDING * 2),
    height: Math.max(MIN_HEIGHT, bottom - top + TABLE_PADDING * 2),
  };
}

/**
 * Layout físico descartable. Se deriva de la proyección tradicional y mantiene
 * cuatro sectores estables alrededor del único chancho ramificador.
 */
export function createTraditionalSnakeLayout(
  table,
  { connectionClearance = 2 } = {},
) {
  const rawMain = table.mainLine.tiles;
  const specialIndex = rawMain.findIndex((tile) => tile.isSpecialDouble);
  const occupied = [];
  const tileByPlacementId = new Map();
  const rootFacesByArmId = new Map();
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
        const initialDirection = arm.armIndex === 1 ? "up" : "down";
        const rootFace = {
          ...arm.origin,
          side: initialDirection === "up" ? "top" : "bottom",
        };
        rootFacesByArmId.set(arm.id, rootFace);
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

  const tiles = [...tileByPlacementId.values()];
  const size = normalizeTiles(tiles);
  const mainTiles = rawMain.map((tile) => tileByPlacementId.get(tile.placementId));
  const branchFamilies = table.branchFamilies.map((family) => ({
    ...family,
    root: tileByPlacementId.get(family.rootPlacementId),
    arms: family.arms.map((arm) => ({
      ...arm,
      direction: arm.armIndex === 1 ? "up" : "down",
      rootFace: rootFacesByArmId.get(arm.id),
      tiles: arm.tiles.map((tile) => tileByPlacementId.get(tile.placementId)),
    })),
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
      face = family.arms.find(
        (candidate) => candidate.armIndex === target.topology.armIndex,
      ).rootFace;
    } else {
      face = faceForPort(anchor, target.portId);
    }
    openFacesByTargetId.set(target.id, { anchor, face });
  }

  return {
    ...size,
    mainTiles,
    branchFamilies,
    tiles,
    connections,
    openFacesByTargetId,
    layoutStats: {
      strategy: specialIndex >= 0 ? "four-arm-snake" : "linear-snake",
      turnCount,
      collisionMargin: COLLISION_MARGIN,
      expandedCanvas:
        size.width > SOFT_HALF_WIDTH * 2 ||
        size.height > SOFT_HALF_HEIGHT * 2,
    },
  };
}
