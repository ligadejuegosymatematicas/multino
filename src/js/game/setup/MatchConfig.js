import { domainAssert } from "../errors/DomainError.js";

export const ROUND_STRUCTURE_MODES = Object.freeze({
  BRANCHED: "RAMIFICADO",
  LINEAR: "LINEAL",
});

export function validateRoundStructureMode(mode) {
  domainAssert(
    Object.values(ROUND_STRUCTURE_MODES).includes(mode),
    "INVALID_ROUND_STRUCTURE_MODE",
    "El modo estructural debe ser RAMIFICADO o LINEAL.",
    { mode },
  );
  return mode;
}

/** Codificación interna transitoria del schema v6: RAMIFICADO=1, LINEAL=0. */
export function getInternalSpecialDoubleLimit(mode) {
  return validateRoundStructureMode(mode) === ROUND_STRUCTURE_MODES.BRANCHED
    ? 1
    : 0;
}

/** Lee el campo legado; los valores positivos históricos significan RAMIFICADO. */
export function validateInternalSpecialDoubleLimit(value) {
  domainAssert(
    typeof value === "number" && Number.isFinite(value) && Number.isInteger(value),
    "INVALID_INTERNAL_STRUCTURE_MODE",
    "La codificación estructural interna debe ser un entero finito.",
    { value },
  );
  domainAssert(
    value >= 0,
    "INVALID_INTERNAL_STRUCTURE_MODE",
    "La codificación estructural interna no puede ser negativa.",
    { value },
  );
  return value;
}

export function getRoundStructureMode(configOrLimit) {
  const value = typeof configOrLimit === "object" && configOrLimit !== null
    ? configOrLimit.specialMainLineDoublesLimit
    : configOrLimit;
  return validateInternalSpecialDoubleLimit(value) === 0
    ? ROUND_STRUCTURE_MODES.LINEAR
    : ROUND_STRUCTURE_MODES.BRANCHED;
}

export function isBranchedRound(configOrLimit) {
  return getRoundStructureMode(configOrLimit) === ROUND_STRUCTURE_MODES.BRANCHED;
}
