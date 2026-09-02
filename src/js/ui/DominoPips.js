const PIP_POSITIONS = Object.freeze({
  0: [],
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
});

/** Puntos de una mitad de dominó, compartidos por mesa y mano. */
export function renderPipsMarkup(
  value,
  { gridClass, pipClass },
) {
  const occupied = new Set(PIP_POSITIONS[value]);
  return `<span class="${gridClass}" data-value="${value}" aria-hidden="true">${Array.from(
    { length: 9 },
    (_, index) =>
      `<i class="${pipClass}${occupied.has(index + 1) ? " is-visible" : ""}"></i>`,
  ).join("")}</span>`;
}
