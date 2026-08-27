import { DomainError, domainAssert } from "../errors/DomainError.js";

export const DOUBLE_SIX_MIN_VALUE = 0;
export const DOUBLE_SIX_MAX_VALUE = 6;
export const DOUBLE_SIX_DOMINO_COUNT = 28;

function assertDominoValue(value, label) {
  domainAssert(
    Number.isInteger(value) &&
      value >= DOUBLE_SIX_MIN_VALUE &&
      value <= DOUBLE_SIX_MAX_VALUE,
    "INVALID_DOMINO_VALUE",
    `${label} debe ser un entero entre 0 y 6.`,
    { label, value },
  );

  return value;
}

/**
 * Crea la definición física y serializable de una ficha.
 * Valida el dominio doble-seis y conserva únicamente sus dos lados.
 */
export function createDomino({ id, values }) {
  domainAssert(
    typeof id === "string" && id.trim().length > 0,
    "INVALID_DOMINO_ID",
    "domino.id debe ser un string no vacío.",
    { id },
  );

  if (!Array.isArray(values) || values.length !== 2) {
    throw new DomainError(
      "INVALID_DOMINO_SIDES",
      "domino.values debe contener exactamente dos lados.",
      { values },
    );
  }

  const firstValue = assertDominoValue(values[0], "domino.values[0]");
  const secondValue = assertDominoValue(values[1], "domino.values[1]");

  return {
    id,
    sides: [
      { id: "a", value: firstValue },
      { id: "b", value: secondValue },
    ],
  };
}

export function isDouble(domino) {
  return domino.sides[0].value === domino.sides[1].value;
}

export function createDominoId(firstValue, secondValue) {
  assertDominoValue(firstValue, "firstValue");
  assertDominoValue(secondValue, "secondValue");

  const lowerValue = Math.min(firstValue, secondValue);
  const higherValue = Math.max(firstValue, secondValue);
  return `${lowerValue}-${higherValue}`;
}

/**
 * R-005: genera las 28 combinaciones canónicas del doble-seis.
 */
export function generateDoubleSixSet() {
  const dominoes = [];

  for (
    let firstValue = DOUBLE_SIX_MIN_VALUE;
    firstValue <= DOUBLE_SIX_MAX_VALUE;
    firstValue += 1
  ) {
    for (
      let secondValue = firstValue;
      secondValue <= DOUBLE_SIX_MAX_VALUE;
      secondValue += 1
    ) {
      dominoes.push(
        createDomino({
          id: createDominoId(firstValue, secondValue),
          values: [firstValue, secondValue],
        }),
      );
    }
  }

  domainAssert(
    dominoes.length === DOUBLE_SIX_DOMINO_COUNT,
    "INVALID_GENERATED_DOMINO_SET",
    "La generación del doble-seis no produjo exactamente 28 fichas.",
    { count: dominoes.length },
  );

  return dominoes;
}
