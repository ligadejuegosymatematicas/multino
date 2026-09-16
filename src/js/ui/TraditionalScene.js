const MAIN_SLOT = 84;
const BRANCH_SLOT = 82;
const TILE_LONG = 72;
const TILE_SHORT = 38;
const MIN_WIDTH = 260;
const MIN_HEIGHT = 220;
const TABLE_PADDING = 44;
export const TRADITIONAL_CONNECTION_CLEARANCE = 2;
export const TRADITIONAL_TARGET_CENTER_DISTANCE = 20;
export const TRADITIONAL_TARGET_HIT_SIZE = 32;
export const TRADITIONAL_MIN_READABLE_SCALE = 0.68;
export const TRADITIONAL_FINAL_MIN_SCALE = 0.18;

function targetIdentity(target) {
  return target.kind === "START" ? "START" : target.id;
}

function tileDimensions(tile) {
  const vertical = tile.region === "main" ? tile.isDouble : !tile.isDouble;
  return {
    orientation: vertical ? "vertical" : "horizontal",
    width: vertical ? TILE_SHORT : TILE_LONG,
    height: vertical ? TILE_LONG : TILE_SHORT,
  };
}

function physicalSidesFor(direction) {
  switch (direction) {
    case "right":
      return { start: "left", end: "right" };
    case "up":
      return { start: "bottom", end: "top" };
    case "down":
      return { start: "top", end: "bottom" };
    default:
      throw new TypeError(`Dirección tradicional desconocida: ${direction}.`);
  }
}

function valueAtPhysicalSide(tile, sides, physicalSide, fallbackIndex) {
  if (sides.start === physicalSide) {
    return tile.start.value;
  }
  if (sides.end === physicalSide) {
    return tile.end.value;
  }
  return tile.values[fallbackIndex];
}

function projectTile(tile, x, y, direction) {
  const dimensions = tileDimensions(tile);
  const sides = physicalSidesFor(direction);
  const firstSide = dimensions.orientation === "horizontal" ? "left" : "top";
  const secondSide = dimensions.orientation === "horizontal"
    ? "right"
    : "bottom";
  return {
    ...tile,
    ...dimensions,
    x,
    y,
    direction,
    physicalStart: { ...tile.start, side: sides.start },
    physicalEnd: { ...tile.end, side: sides.end },
    firstValue: valueAtPhysicalSide(
      tile,
      sides,
      firstSide,
      0,
    ),
    secondValue: valueAtPhysicalSide(
      tile,
      sides,
      secondSide,
      1,
    ),
  };
}

function createConnection(
  id,
  first,
  second,
  firstFace,
  secondFace,
  region,
) {
  if (firstFace.value !== secondFace.value) {
    throw new Error(
      `La conexión visual ${id} enfrenta ${firstFace.value} con ${secondFace.value}.`,
    );
  }
  const firstPoint = pointOutsideTile(
    first,
    firstFace,
    TRADITIONAL_CONNECTION_CLEARANCE,
  );
  const secondPoint = pointOutsideTile(
    second,
    secondFace,
    TRADITIONAL_CONNECTION_CLEARANCE,
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
    orientation: firstPoint.y === secondPoint.y ? "horizontal" : "vertical",
  };
}

function pointOutsideTile(tile, face, distance) {
  switch (face.side) {
    case "left":
      return { x: tile.x - tile.width / 2 - distance, y: tile.y };
    case "right":
      return { x: tile.x + tile.width / 2 + distance, y: tile.y };
    case "top":
      return { x: tile.x, y: tile.y - tile.height / 2 - distance };
    case "bottom":
      return { x: tile.x, y: tile.y + tile.height / 2 + distance };
    default:
      throw new TypeError(`Cara tradicional desconocida: ${face.side}.`);
  }
}

function createTargetScene(
  target,
  x,
  y,
  direction,
  legalTargetIds,
  hasSelection,
  isFinished,
  optionIndex = null,
  optionCount = 0,
) {
  const isLegal = !isFinished && hasSelection && legalTargetIds.has(target.id);
  return {
    ...target,
    x,
    y,
    direction,
    isLegal,
    optionIndex,
    isDisabled: !isLegal,
    state: isFinished
      ? "finished"
      : isLegal
        ? "legal"
        : hasSelection
          ? "incompatible"
          : "neutral",
    accessibleLabel: `Extremo de valor ${target.value}, ${target.topology.region === "main" ? "recorrido inicial" : `brazo ${target.topology.armIndex} del chancho ramificador`}${isLegal ? optionIndex === null ? ", destino compatible" : `, opción ${optionIndex} de ${optionCount}` : ""}`,
  };
}

/** Geometría descartable de la mesa tradicional; nunca se persiste. */
export function createTraditionalScene(
  view,
  {
    selectedDominoId = null,
    legalTargets = [],
    isFinished = view.roundStatus.phase === "finished",
    scoringResolution = null,
  } = {},
) {
  const hasSelection = selectedDominoId !== null;
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
  const mainCount = view.table.mainLine.tiles.length;
  const maxUpDepth = Math.max(
    0,
    ...view.table.branchFamilies.map((family) =>
      family.arms[0].tiles.length + 1
    ),
  );
  const maxDownDepth = Math.max(
    0,
    ...view.table.branchFamilies.map((family) =>
      family.arms[1].tiles.length + 1
    ),
  );
  const width = Math.max(
    MIN_WIDTH,
    TABLE_PADDING * 2 + Math.max(mainCount, 1) * MAIN_SLOT,
  );
  const requiredHeight =
    TABLE_PADDING * 2 + (maxUpDepth + maxDownDepth) * BRANCH_SLOT;
  const height = Math.max(MIN_HEIGHT, requiredHeight);
  const mainY =
    (height - requiredHeight) / 2 + TABLE_PADDING + maxUpDepth * BRANCH_SLOT;
  const sequenceWidth = Math.max(mainCount, 1) * MAIN_SLOT;
  const firstMainX = (width - sequenceWidth) / 2 + MAIN_SLOT / 2;
  const mainTiles = view.table.mainLine.tiles.map((tile, index) =>
    projectTile(tile, firstMainX + index * MAIN_SLOT, mainY, "right")
  );
  const tileByPlacementId = new Map(
    mainTiles.map((tile) => [tile.placementId, tile]),
  );
  const connections = [];

  mainTiles.slice(0, -1).forEach((tile, index) => {
    connections.push(
      createConnection(
        view.table.mainLine.connectionIds[index],
        tile,
        mainTiles[index + 1],
        tile.physicalEnd,
        mainTiles[index + 1].physicalStart,
        "main",
      ),
    );
  });

  const branchFamilies = view.table.branchFamilies.map((family) => {
    const root = tileByPlacementId.get(family.rootPlacementId);
    const arms = family.arms.map((arm) => {
      const direction = arm.armIndex === 1 ? -1 : 1;
      const directionName = direction < 0 ? "up" : "down";
      const tiles = arm.tiles.map((tile, index) =>
        projectTile(
          tile,
          root.x,
          mainY + direction * (index + 1) * BRANCH_SLOT,
          directionName,
        )
      );
      tiles.forEach((tile) => tileByPlacementId.set(tile.placementId, tile));
      tiles.forEach((tile, index) => {
        const previous = index === 0 ? root : tiles[index - 1];
        const previousFace = index === 0
          ? {
              ...arm.origin,
              side: direction < 0 ? "top" : "bottom",
            }
          : previous.physicalEnd;
        connections.push(
          createConnection(
            arm.connectionIds[index],
            previous,
            tile,
            previousFace,
            tile.physicalStart,
            "branch",
          ),
        );
      });
      return {
        ...arm,
        direction: directionName,
        tiles,
      };
    });
    return { ...family, root, arms };
  });

  const compatibleCountByValue = new Map();
  for (const target of view.table.openTargets) {
    if (hasSelection && legalTargetIds.has(target.id)) {
      compatibleCountByValue.set(
        target.value,
        (compatibleCountByValue.get(target.value) ?? 0) + 1,
      );
    }
  }
  const compatibleIndexByValue = new Map();
  const openTargets = view.table.openTargets.map((target) => {
    const isLegal = hasSelection && legalTargetIds.has(target.id);
    let optionIndex = null;
    if (isLegal && compatibleCountByValue.get(target.value) > 1) {
      optionIndex = (compatibleIndexByValue.get(target.value) ?? 0) + 1;
      compatibleIndexByValue.set(target.value, optionIndex);
    }
    if (target.kind === "main") {
      const tile = target.mainLineEnd === "start"
        ? mainTiles[0]
        : mainTiles.at(-1);
      const direction = target.mainLineEnd === "start" ? "left" : "right";
      const face = target.mainLineEnd === "start"
        ? tile.physicalStart
        : tile.physicalEnd;
      const point = pointOutsideTile(
        tile,
        face,
        TRADITIONAL_TARGET_CENTER_DISTANCE,
      );
      return createTargetScene(
        target,
        point.x,
        point.y,
        direction,
        legalTargetIds,
        hasSelection,
        isFinished,
        optionIndex,
        compatibleCountByValue.get(target.value) ?? 0,
      );
    }

    const family = branchFamilies.find(
      (candidate) => candidate.id === target.topology.familyId,
    );
    const arm = family.arms.find(
      (candidate) => candidate.armIndex === target.topology.armIndex,
    );
    const direction = arm.armIndex === 1 ? -1 : 1;
    const anchor = arm.tiles.at(-1) ?? family.root;
    const face = arm.tiles.length > 0
      ? anchor.physicalEnd
      : {
          ...arm.origin,
          side: direction < 0 ? "top" : "bottom",
        };
    const point = pointOutsideTile(
      anchor,
      face,
      TRADITIONAL_TARGET_CENTER_DISTANCE,
    );
    return createTargetScene(
      target,
      point.x,
      point.y,
      direction < 0 ? "up" : "down",
      legalTargetIds,
      hasSelection,
      isFinished,
      optionIndex,
      compatibleCountByValue.get(target.value) ?? 0,
    );
  });

  for (const tile of tileByPlacementId.values()) {
    tile.isScoringTerm = scoringDoublePlacementIds.has(tile.placementId);
  }
  for (const target of openTargets) {
    target.isScoringTerm = scoringPortIds.has(target.id);
  }

  return {
    width,
    height,
    mainY,
    hasSelection,
    isFinished,
    selectedDominoId,
    canStart:
      !isFinished && hasSelection && legalTargetIds.has("START"),
    mainTiles,
    branchFamilies,
    tiles: [...tileByPlacementId.values()],
    connections,
    openTargets,
  };
}

/** Escala inicial de cámara: ajusta sin volver ilegibles las fichas. */
export function calculateTraditionalFitScale({
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
  minScale = TRADITIONAL_MIN_READABLE_SCALE,
  maxScale = 1.35,
  padding = 18,
}) {
  const usableWidth = Math.max(viewportWidth - padding * 2, 1);
  const usableHeight = Math.max(viewportHeight - padding * 2, 1);
  const fitted = Math.min(
    maxScale,
    usableWidth / contentWidth,
    usableHeight / contentHeight,
  );
  return Math.max(minScale, Number(fitted.toFixed(3)));
}
