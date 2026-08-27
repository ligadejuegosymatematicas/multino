import { domainAssert } from "../errors/DomainError.js";
import { DOUBLE_SIX_MAX_VALUE } from "../model/Domino.js";

/** R-027 y DEC-011. */
export function validateSpecialDoubleLimit(K) {
  domainAssert(
    typeof K === "number" && Number.isFinite(K) && Number.isInteger(K),
    "INVALID_K_TYPE",
    "K debe ser un número entero finito.",
    { K },
  );
  domainAssert(
    K >= 0,
    "INVALID_K_RANGE",
    "K debe ser mayor o igual que cero.",
    { K },
  );

  return K;
}

export function getEffectiveK(K) {
  return Math.min(validateSpecialDoubleLimit(K), DOUBLE_SIX_MAX_VALUE + 1);
}

