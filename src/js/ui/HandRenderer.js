import { createDominoTileElement } from "./DominoTile.js";

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

  button.append(createDominoTileElement(domino));
  if (domino.legalTargetCount > 1) {
    const status = document.createElement("span");
    status.className = "hand-domino__status";
    status.textContent = `${domino.legalTargetCount} destinos`;
    button.append(status);
  }
  button.addEventListener("click", () => onSelect?.(domino.dominoId));
  return button;
}

export function renderTurnAction(container, presentation) {
  if (!container) {
    return;
  }
  const selected = presentation.view.hand.find(
    (domino) => domino.dominoId === presentation.selectedDominoId,
  ) ?? null;
  container.replaceChildren();
  container.classList.toggle("has-selection", selected !== null);

  const copy = document.createElement("div");
  copy.className = "turn-action__copy";
  const kicker = document.createElement("span");
  kicker.className = "turn-action__kicker";
  kicker.textContent = selected ? "Ficha seleccionada" : "Tu turno";
  const title = document.createElement("strong");
  title.textContent = selected
    ? `${selected.a}|${selected.b}`
    : "";
  const detail = document.createElement("span");
  detail.className = "turn-action__detail";
  detail.textContent = selected
    ? `${presentation.selectedLegalTargets.length} ${presentation.selectedLegalTargets.length === 1 ? "destino legal" : "destinos legales"}`
    : "";
  copy.append(kicker);
  if (title.textContent !== "") copy.append(title);
  if (detail.textContent !== "") copy.append(detail);
  if (selected) {
    const visual = createDominoTileElement(selected, {
      className: "turn-action__tile",
    });
    container.append(visual);
  }
  container.append(copy);
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
