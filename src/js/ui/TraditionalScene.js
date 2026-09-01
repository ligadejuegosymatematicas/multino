const MAIN_SLOT = 84;
const BRANCH_SLOT = 82;
const TILE_LONG = 72;
const TILE_SHORT = 38;
const MIN_WIDTH = 720;
const MIN_HEIGHT = 430;
const TABLE_PADDING = 72;

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

function projectTile(tile, x, y) {
  return {
    ...tile,
    ...tileDimensions(tile),
    x,
    y,
    firstValue: tile.start.value,
    secondValue: tile.end.value,
  };
}

function createConnection(id, first, second, region, familyIndex = null) {
  return {
    id,
    region,
    familyIndex,
    x1: first.x,
    y1: first.y,
    x2: second.x,
    y2: second.y,
    orientation: first.y === second.y ? "horizontal" : "vertical",
  };
}

function createTargetScene(
  target,
  x,
  y,
  direction,
  legalTargetIds,
  hasSelection,
  isFinished,
) {
  const isLegal = !isFinished && hasSelection && legalTargetIds.has(target.id);
  return {
    ...target,
    x,
    y,
    direction,
    isLegal,
    isDisabled: !isLegal,
    state: isFinished
      ? "finished"
      : isLegal
        ? "legal"
        : hasSelection
          ? "incompatible"
          : "neutral",
    accessibleLabel: `Extremo ${target.topology.structureCode}, valor ${target.value}, ${target.topology.region === "main" ? "línea principal" : `${target.topology.familyLabel}, brazo ${target.topology.armIndex}`}${isLegal ? ", destino compatible" : ""}`,
  };
}

/** Geometría descartable de la mesa tradicional; nunca se persiste. */
export function createTraditionalScene(
  view,
  {
    selectedDominoId = null,
    legalTargets = [],
    isFinished = view.roundStatus.phase === "finished",
  } = {},
) {
  const hasSelection = selectedDominoId !== null;
  const legalTargetIds = new Set(legalTargets.map(targetIdentity));
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
    projectTile(tile, firstMainX + index * MAIN_SLOT, mainY)
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
        "main",
      ),
    );
  });

  const branchFamilies = view.table.branchFamilies.map((family) => {
    const root = tileByPlacementId.get(family.rootPlacementId);
    const arms = family.arms.map((arm) => {
      const direction = arm.armIndex === 1 ? -1 : 1;
      const tiles = arm.tiles.map((tile, index) =>
        projectTile(
          tile,
          root.x,
          mainY + direction * (index + 1) * BRANCH_SLOT,
        )
      );
      tiles.forEach((tile) => tileByPlacementId.set(tile.placementId, tile));
      tiles.forEach((tile, index) => {
        connections.push(
          createConnection(
            arm.connectionIds[index],
            index === 0 ? root : tiles[index - 1],
            tile,
            "branch",
            family.familyIndex,
          ),
        );
      });
      return {
        ...arm,
        direction: direction < 0 ? "up" : "down",
        tiles,
      };
    });
    return { ...family, root, arms };
  });

  const openTargets = view.table.openTargets.map((target) => {
    if (target.kind === "main") {
      const tile = target.mainLineEnd === "start"
        ? mainTiles[0]
        : mainTiles.at(-1);
      const direction = target.mainLineEnd === "start" ? "left" : "right";
      return createTargetScene(
        target,
        tile.x + (direction === "left" ? -MAIN_SLOT : MAIN_SLOT),
        mainY,
        direction,
        legalTargetIds,
        hasSelection,
        isFinished,
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
    return createTargetScene(
      target,
      anchor.x,
      anchor.y + direction * BRANCH_SLOT,
      direction < 0 ? "up" : "down",
      legalTargetIds,
      hasSelection,
      isFinished,
    );
  });

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
    specialSummary: { ...view.table.specialDoubles },
  };
}
