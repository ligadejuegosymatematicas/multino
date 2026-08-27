import { domainAssert } from "../errors/DomainError.js";

export function parseSequentialId(id, prefix) {
  if (typeof id !== "string") {
    return null;
  }

  const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
  if (!match) {
    return null;
  }

  const sequence = Number(match[1]);
  return Number.isSafeInteger(sequence) && sequence > 0 ? sequence : null;
}

/** DEC-027: deriva el próximo ID sin contadores ocultos. */
export function getNextSequentialId(records, prefix) {
  domainAssert(
    records !== null && typeof records === "object" && !Array.isArray(records),
    "INVALID_ID_SOURCE",
    `La fuente de IDs ${prefix} debe ser un mapa.`,
    { records, prefix },
  );

  const maximum = Object.keys(records).reduce((currentMaximum, id) => {
    const sequence = parseSequentialId(id, prefix);
    domainAssert(
      sequence !== null,
      "INVALID_SEQUENTIAL_ID",
      `El ID ${String(id)} no sigue el formato ${prefix}-N.`,
      { id, prefix },
    );
    return Math.max(currentMaximum, sequence);
  }, 0);

  return `${prefix}-${maximum + 1}`;
}

export function getNextHistorySequence(history) {
  domainAssert(
    Array.isArray(history),
    "INVALID_HISTORY",
    "history debe ser un array.",
    { history },
  );

  const maximum = history.reduce((currentMaximum, entry) => {
    domainAssert(
      Number.isSafeInteger(entry?.sequence) && entry.sequence > 0,
      "INVALID_HISTORY_SEQUENCE",
      "Cada acción histórica debe tener una secuencia entera positiva.",
      { entry },
    );
    return Math.max(currentMaximum, entry.sequence);
  }, 0);

  return maximum + 1;
}
