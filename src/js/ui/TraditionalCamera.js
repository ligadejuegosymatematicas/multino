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
