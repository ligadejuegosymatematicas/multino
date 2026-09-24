// Render the frozen SVG at its viewBox size, then scale its entire image.
// Resizing the SVG viewport itself keeps its non-scaling strokes too thick.
export function getBrandScale(width) {
  return Number.isFinite(width) && width > 0 ? width / 1000 : 0;
}

export function observeBrandPresentation(root = document) {
  const observer = new ResizeObserver((entries) => {
    for (const { target, contentRect } of entries) {
      target.style.setProperty("--brand-scale", String(getBrandScale(contentRect.width)));
    }
  });
  for (const artboard of root.querySelectorAll(".brand-artboard")) {
    observer.observe(artboard);
  }
  return observer;
}
