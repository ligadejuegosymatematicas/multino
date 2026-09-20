import {
  createTraditionalSnakeLayout,
  pointOutsideTraditionalTile,
  previewTraditionalPlacement,
} from "./TraditionalSnakeLayout.js";

export const TRADITIONAL_CONNECTION_CLEARANCE = 2;
export const TRADITIONAL_TARGET_CENTER_DISTANCE = 20;
export const TRADITIONAL_TARGET_HIT_SIZE = 32;
export const TRADITIONAL_MIN_READABLE_SCALE = 0.52;
export const TRADITIONAL_FINAL_MIN_SCALE = 0.5;
export const TRADITIONAL_INITIAL_MAX_SCALE = 0.92;

function targetIdentity(target) {
  return target.kind === "START" ? "START" : target.id;
}

function previewGhostPlacement(layout, target, domino) {
  try {
    return previewTraditionalPlacement(
      layout,
      target,
      domino,
      { connectionClearance: TRADITIONAL_CONNECTION_CLEARANCE },
    );
  } catch {
    // Un corredor muy denso puede impedir una previsualización limpia para un
    // target concreto. No debe cancelar los otros lugares físicos ni dejar la
    // mesa sin render: el socket legal sigue disponible como fallback espacial.
    return null;
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

function createLockedRamifierSockets(view, tileByPlacementId) {
  const ramifier = view.structure.branchingDouble;
  if (!ramifier || ramifier.lateralPortsUnlocked) {
    return [];
  }
  const tile = tileByPlacementId.get(ramifier.placementId);
  if (!tile) return [];
  const sides = tile.orientation === "vertical"
    ? ["top", "bottom"]
    : ["left", "right"];
  return sides.map((side, index) => ({
    id: `${ramifier.placementId}:branch:${index + 1}:locked`,
    placementId: ramifier.placementId,
    portId: `branch:${index + 1}`,
    side,
    ...pointOutsideTraditionalTile(tile, { side }, 8),
  }));
}

/** Geometría descartable de la mesa tradicional; nunca se persiste. */
export function createTraditionalScene(
  view,
  {
    selectedDominoId = null,
    legalTargets = [],
    isFinished = view.roundStatus.phase === "finished",
    scoringResolution = null,
    previousLayout = null,
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
      .filter((term) =>
        term.isDouble &&
        (term.isContributing ?? term.contribution > 0)
      )
      .map((term) => term.placementId),
  );
  const layout = createTraditionalSnakeLayout(view.table, {
    connectionClearance: TRADITIONAL_CONNECTION_CLEARANCE,
    previousLayout,
  });
  const {
    width,
    height,
    mainTiles: layoutMainTiles,
    branchFamilies: layoutBranchFamilies,
    tiles,
    connections,
    openFacesByTargetId,
    layoutStats,
    contentBounds,
  } = layout;
  const sceneTiles = tiles.map((tile) => ({
    ...tile,
    isScoringTerm: scoringDoublePlacementIds.has(tile.placementId),
  }));
  const sceneTileByPlacementId = new Map(
    sceneTiles.map((tile) => [tile.placementId, tile]),
  );
  const mainTiles = layoutMainTiles.map((tile) =>
    sceneTileByPlacementId.get(tile.placementId)
  );
  const branchFamilies = layoutBranchFamilies.map((family) => ({
    ...family,
    root: sceneTileByPlacementId.get(family.root.placementId),
    arms: family.arms.map((arm) => ({
      ...arm,
      tiles: arm.tiles.map((tile) =>
        sceneTileByPlacementId.get(tile.placementId)
      ),
    })),
  }));
  const mainY = mainTiles.length > 0
    ? mainTiles.reduce((sum, tile) => sum + tile.y, 0) / mainTiles.length
    : height / 2;

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
    const { anchor, face } = openFacesByTargetId.get(target.id);
    const point = pointOutsideTraditionalTile(
      anchor,
      face,
      TRADITIONAL_TARGET_CENTER_DISTANCE,
    );
    return createTargetScene(
      target,
      point.x,
      point.y,
      face.side === "top"
        ? "up"
        : face.side === "bottom"
          ? "down"
          : face.side,
      legalTargetIds,
      hasSelection,
      isFinished,
      optionIndex,
      compatibleCountByValue.get(target.value) ?? 0,
    );
  });

  for (const target of openTargets) {
    target.isScoringTerm = scoringPortIds.has(target.id);
  }

  const selectedDomino = view.hand.find(
    (domino) => domino.dominoId === selectedDominoId,
  ) ?? null;
  const ghostPlacements = isFinished || selectedDomino === null
    ? []
    : openTargets
      .filter((target) => target.isLegal)
      .map((target) => previewGhostPlacement(layout, target, selectedDomino))
      .filter(Boolean)
      .map((ghost) => ({
        ...ghost,
        accessibleLabel: `Jugar ficha ${selectedDomino.a}|${selectedDomino.b} en el extremo de valor ${view.table.openTargets.find((target) => target.id === ghost.id)?.value}`,
      }));

  const lockedRamifierSockets = createLockedRamifierSockets(
    view,
    sceneTileByPlacementId,
  );

  return {
    width,
    height,
    mainY,
    hasSelection,
    isFinished,
    selectedDominoId,
    selectedDomino,
    canStart:
      !isFinished && hasSelection && legalTargetIds.has("START"),
    mainTiles,
    branchFamilies,
    tiles: sceneTiles,
    connections,
    openTargets,
    ghostPlacements,
    lockedRamifierSockets,
    scoringResolution,
    layoutStats,
    contentBounds,
    layoutState: layout,
  };
}

/** Escala inicial de cámara: ajusta sin volver ilegibles las fichas. */
export function calculateTraditionalFitScale({
  contentWidth,
  contentHeight,
  viewportWidth,
  viewportHeight,
  minScale = TRADITIONAL_MIN_READABLE_SCALE,
  maxScale = TRADITIONAL_INITIAL_MAX_SCALE,
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
