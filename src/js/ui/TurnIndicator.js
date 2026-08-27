export function renderTurnStatus(container, message) {
  if (!container) {
    return;
  }

  container.textContent = message;
}

