function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}

function cameraLimits({ tableWidth, tableHeight, scale, viewportWidth, viewportHeight }) {
  return {
    maxLeft: Math.max(0, tableWidth * scale - viewportWidth),
    maxTop: Math.max(0, tableHeight * scale - viewportHeight),
  };
}

export function createTraditionalFitCamera({
  scale,
  contentBounds,
  tableWidth,
  tableHeight,
  viewportWidth,
  viewportHeight,
}) {
  const { maxLeft, maxTop } = cameraLimits({
    tableWidth,
    tableHeight,
    scale,
    viewportWidth,
    viewportHeight,
  });
  return {
    scale,
    left: clamp(
      contentBounds.centerX * scale - viewportWidth / 2,
      0,
      maxLeft,
    ),
    top: clamp(
      contentBounds.centerY * scale - viewportHeight / 2,
      0,
      maxTop,
    ),
    viewportWidth,
    viewportHeight,
  };
}

/**
 * Auto-fit incremental: la escala solo puede mantenerse o disminuir durante
 * una ronda. Conserva el centro mundial que el jugador estaba mirando y luego
 * aplica únicamente la corrección necesaria para incluir toda la mesa.
 */
export function createTraditionalProgressiveCamera(
  camera,
  {
    fitScale,
    contentBounds,
    tableWidth,
    tableHeight,
    viewportWidth,
    viewportHeight,
    margin = 18,
  },
) {
  const scale = Math.min(camera.scale, fitScale);
  const worldCenter = {
    x: (camera.left + camera.viewportWidth / 2) / camera.scale,
    y: (camera.top + camera.viewportHeight / 2) / camera.scale,
  };
  const centered = preserveTraditionalCamera({
    ...camera,
    scale,
    left: worldCenter.x * scale - viewportWidth / 2,
    top: worldCenter.y * scale - viewportHeight / 2,
  }, {
    tableWidth,
    tableHeight,
    viewportWidth,
    viewportHeight,
  });
  return revealTraditionalWorldBounds(centered, contentBounds, {
    tableWidth,
    tableHeight,
    viewportWidth,
    viewportHeight,
    margin,
  });
}

export function preserveTraditionalCamera(camera, {
  tableWidth,
  tableHeight,
  viewportWidth,
  viewportHeight,
}) {
  const { maxLeft, maxTop } = cameraLimits({
    tableWidth,
    tableHeight,
    scale: camera.scale,
    viewportWidth,
    viewportHeight,
  });
  return {
    ...camera,
    left: clamp(camera.left, 0, maxLeft),
    top: clamp(camera.top, 0, maxTop),
    viewportWidth,
    viewportHeight,
  };
}

export function revealTraditionalWorldBounds(camera, bounds, {
  tableWidth,
  tableHeight,
  viewportWidth,
  viewportHeight,
  margin = 42,
}) {
  const left = bounds.left * camera.scale - margin;
  const right = bounds.right * camera.scale + margin;
  const top = bounds.top * camera.scale - margin;
  const bottom = bounds.bottom * camera.scale + margin;
  let nextLeft = camera.left;
  let nextTop = camera.top;

  if (left < nextLeft) nextLeft = left;
  else if (right > nextLeft + viewportWidth) nextLeft = right - viewportWidth;
  if (top < nextTop) nextTop = top;
  else if (bottom > nextTop + viewportHeight) nextTop = bottom - viewportHeight;

  const { maxLeft, maxTop } = cameraLimits({
    tableWidth,
    tableHeight,
    scale: camera.scale,
    viewportWidth,
    viewportHeight,
  });
  return {
    ...camera,
    left: clamp(nextLeft, 0, maxLeft),
    top: clamp(nextTop, 0, maxTop),
    viewportWidth,
    viewportHeight,
  };
}

export function createTraditionalAutoPanPlan(currentCamera, requestedCamera) {
  if (
    currentCamera.left === requestedCamera.left &&
    currentCamera.top === requestedCamera.top
  ) {
    return null;
  }
  return {
    from: {
      left: currentCamera.left,
      top: currentCamera.top,
    },
    to: {
      left: requestedCamera.left,
      top: requestedCamera.top,
    },
    delta: {
      left: requestedCamera.left - currentCamera.left,
      top: requestedCamera.top - currentCamera.top,
    },
    scale: currentCamera.scale,
  };
}

export function sampleTraditionalAutoPan(plan, progress) {
  const clampedProgress = clamp(progress, 0, 1);
  const easedProgress = 1 - ((1 - clampedProgress) ** 3);
  return {
    left: plan.from.left + plan.delta.left * easedProgress,
    top: plan.from.top + plan.delta.top * easedProgress,
  };
}

export function createTraditionalCameraTransitionPlan(
  currentCamera,
  requestedCamera,
) {
  if (
    currentCamera.left === requestedCamera.left &&
    currentCamera.top === requestedCamera.top &&
    currentCamera.scale === requestedCamera.scale
  ) return null;
  return {
    from: {
      left: currentCamera.left,
      top: currentCamera.top,
      scale: currentCamera.scale,
    },
    to: {
      left: requestedCamera.left,
      top: requestedCamera.top,
      scale: requestedCamera.scale,
    },
    delta: {
      left: requestedCamera.left - currentCamera.left,
      top: requestedCamera.top - currentCamera.top,
      scale: requestedCamera.scale - currentCamera.scale,
    },
  };
}

export function sampleTraditionalCameraTransition(plan, progress) {
  const clampedProgress = clamp(progress, 0, 1);
  const easedProgress = 1 - ((1 - clampedProgress) ** 3);
  return {
    left: plan.from.left + plan.delta.left * easedProgress,
    top: plan.from.top + plan.delta.top * easedProgress,
    scale: plan.from.scale + plan.delta.scale * easedProgress,
  };
}

export function isTraditionalOrientationChange(previous, next) {
  if (
    !previous ||
    previous.width <= 0 ||
    previous.height <= 0 ||
    next.width <= 0 ||
    next.height <= 0
  ) {
    return false;
  }
  return (previous.width >= previous.height) !== (next.width >= next.height);
}
