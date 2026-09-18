import { PLAY_SCORING_POLICY } from "../engine/Scoring.js";
import { getLatestActionProjection } from "./ActionProjection.js";
import { getScoringProjection } from "./ScoringProjection.js";

export const SCORING_PRESENTATION_POLICY_TYPES = Object.freeze({
  DIVISIBLE: "DIVISIBLE",
  DISABLED: "DISABLED",
});

function validatePolicy(policy) {
  if (!policy || typeof policy !== "object") {
    throw new TypeError("La política de presentación debe ser un objeto.");
  }
  if (policy.enabled === false) {
    return;
  }
  if (
    policy.enabled !== true ||
    policy.policyType !== SCORING_PRESENTATION_POLICY_TYPES.DIVISIBLE ||
    !Number.isSafeInteger(policy.divisor) ||
    policy.divisor <= 0
  ) {
    throw new TypeError("La política divisible requiere un divisor positivo.");
  }
}

function valueFromDoubleTerm(term) {
  const [value] = term.dominoId.split("-").map(Number);
  return value;
}

function projectTerm(term) {
  const isDouble = !Object.hasOwn(term, "portId");
  const value = isDouble ? valueFromDoubleTerm(term) : term.value;
  const factor = isDouble
    ? term.contribution > 0 ? 2 : 0
    : 1;
  return {
    placementId: term.placementId,
    dominoId: term.dominoId,
    portId: term.portId ?? null,
    value,
    factor,
    contribution: term.contribution,
    isDouble,
    isContributing: term.contribution > 0,
    reason: term.reason,
    label: factor === 2 ? `2×${value}` : String(term.contribution),
  };
}

/**
 * Contrato visual puro. `policy.enabled=false` prepara la ausencia futura de S
 * sin activar hoy una variante reglamentaria.
 */
export function createScoringPresentation({
  terms = [],
  sum = 0,
  latestAction = null,
  policy = PLAY_SCORING_POLICY,
} = {}) {
  validatePolicy(policy);
  if (!policy.enabled) {
    return {
      enabled: false,
      policyType: SCORING_PRESENTATION_POLICY_TYPES.DISABLED,
      divisor: null,
      terms: [],
      sum: null,
      expression: null,
      latestResolution: null,
    };
  }

  const projectedTerms = terms.map(projectTerm);
  const expression = projectedTerms.length > 0
    ? projectedTerms.map((term) => term.label).join(" + ")
    : "0";
  const latestResolution =
    latestAction?.type === "PLAY_DOMINO" &&
    Number.isSafeInteger(latestAction.openEndsSum) &&
    Number.isSafeInteger(latestAction.scoreAwarded)
    ? {
        sequence: latestAction.sequence,
        placementId: latestAction.placementId,
        terms: projectedTerms.map((term) => ({ ...term })),
        expression,
        sum: latestAction.openEndsSum,
        divisor: policy.divisor,
        isDivisible:
          latestAction.openEndsSum % policy.divisor === 0,
        divisionQuotient: Math.floor(
          latestAction.openEndsSum / policy.divisor,
        ),
        remainder: latestAction.openEndsSum % policy.divisor,
        quotient:
          latestAction.openEndsSum % policy.divisor === 0
            ? latestAction.openEndsSum / policy.divisor
            : null,
        scoreAwarded: latestAction.scoreAwarded,
      }
    : null;

  return {
    enabled: true,
    policyType: policy.policyType,
    divisor: policy.divisor,
    terms: projectedTerms,
    sum,
    expression,
    latestResolution,
  };
}

export function getScoringPresentation(
  state,
  { policy = PLAY_SCORING_POLICY } = {},
) {
  if (!policy.enabled) {
    return createScoringPresentation({ policy });
  }
  const scoring = getScoringProjection(state);
  return createScoringPresentation({
    ...scoring,
    latestAction: getLatestActionProjection(state),
    policy,
  });
}
