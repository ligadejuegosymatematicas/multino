export function renderScoreStatus(container, message) {
  if (!container) {
    return;
  }

  container.textContent = message;
}

