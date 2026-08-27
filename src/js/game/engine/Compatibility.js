/** R-028: compatibilidad pura por igualdad de valores. */
export function areValuesCompatible(firstValue, secondValue) {
  return firstValue === secondValue;
}

export function getMatchingSideIds(domino, targetValue) {
  return domino.sides
    .filter((side) => areValuesCompatible(side.value, targetValue))
    .map((side) => side.id);
}

export function isDominoCompatibleWithValue(domino, targetValue) {
  return getMatchingSideIds(domino, targetValue).length > 0;
}
