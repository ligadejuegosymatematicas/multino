import {
  createTraditionalSnakeLayout,
  pointOutsideTraditionalTile,
} from "./TraditionalSnakeLayout.js";

export const TRADITIONAL_CONNECTION_CLEARANCE = 2;
export const TRADITIONAL_TARGET_CENTER_DISTANCE = 20;
export const TRADITIONAL_TARGET_HIT_SIZE = 32;
export const TRADITIONAL_MIN_READABLE_SCALE = 0.68;
export const TRADITIONAL_FINAL_MIN_SCALE = 0.55;

function targetIdentity(target) {
  return target.kind === "START" ? "START" : target.id;
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
  const layout = createTraditionalSnakeLayout(view.table, {
    connectionClearance: TRADITIONAL_CONNECTION_CLEARANCE,
  });
  const {
    width,
    height,
    mainTiles,
    branchFamilies,
    tiles,
    connections,
    openFacesByTargetId,
    layoutStats,
  } = layout;
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

  for (const tile of tiles) {
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
    tiles,
    connections,
    openTargets,
    layoutStats,
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
