export function renderBoardPlaceholder(container) {
  if (!container) {
    return;
  }

  container.textContent =
    "Tablero definitivo pendiente. El renderer todavía no recibe jugadas.";
}

