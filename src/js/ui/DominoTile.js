import { renderPipsMarkup } from "./DominoPips.js";

function assertDominoValue(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 6) {
    throw new TypeError(`${label} debe ser un valor de dominó entre 0 y 6.`);
  }
}

function renderHalf(value) {
  return `<span class="hand-domino__half">${renderPipsMarkup(value, {
    gridClass: "hand-domino__pips",
    pipClass: "hand-domino__pip",
  })}</span>`;
}

/**
 * Fuente visual compartida para fichas de mano, selección y colocaciones ghost.
 * El llamador solo decide clases/atributos; los valores y pips se serializan aquí.
 */
export function renderDominoTileMarkup(
  domino,
  { className = "", attributes = "" } = {},
) {
  assertDominoValue(domino?.a, "domino.a");
  assertDominoValue(domino?.b, "domino.b");
  const classes = ["hand-domino__tile", className].filter(Boolean).join(" ");
  return `<span class="${classes}" data-domino-a="${domino.a}" data-domino-b="${domino.b}"${attributes ? ` ${attributes}` : ""}>${renderHalf(domino.a)}<span aria-hidden="true" class="hand-domino__divider"></span>${renderHalf(domino.b)}</span>`;
}

export function createDominoTileElement(domino, options = {}) {
  const template = document.createElement("template");
  template.innerHTML = renderDominoTileMarkup(domino, options);
  return template.content.firstElementChild;
}
