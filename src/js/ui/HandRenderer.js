function createDominoButton(domino, selected, disabled, onSelect) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hand-domino";
  button.classList.toggle("is-selected", selected);
  button.classList.toggle("is-playable", domino.legalTargetCount > 0);
  button.classList.toggle("is-unplayable", domino.legalTargetCount === 0);
  button.disabled = disabled || domino.legalTargetCount === 0;
  button.dataset.dominoId = domino.dominoId;
  button.setAttribute("aria-pressed", String(selected));
  button.setAttribute(
    "aria-label",
    `Ficha ${domino.a}-${domino.b}, ${domino.legalTargetCount > 0 ? `${domino.legalTargetCount} destinos` : "sin jugada legal"}`,
  );

  const values = document.createElement("span");
  values.className = "hand-domino__values";
  values.innerHTML = `<span>${domino.a}</span><span aria-hidden="true" class="hand-domino__divider"></span><span>${domino.b}</span>`;
  const status = document.createElement("span");
  status.className = "hand-domino__status";
  status.textContent = domino.legalTargetCount > 0
    ? `${domino.legalTargetCount} destino${domino.legalTargetCount === 1 ? "" : "s"}`
    : "Sin jugada";
  button.append(values, status);
  button.addEventListener("click", () => onSelect?.(domino.dominoId));
  return button;
}

export function renderHand(container, presentation, { onSelect } = {}) {
  if (!container) {
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const domino of presentation.view.hand) {
    fragment.append(
      createDominoButton(
        domino,
        presentation.selectedDominoId === domino.dominoId,
        presentation.isFinished,
        onSelect,
      ),
    );
  }
  container.replaceChildren(fragment);
}
