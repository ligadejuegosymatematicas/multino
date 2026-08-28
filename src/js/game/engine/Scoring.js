import { CAPABILITY_IMPLEMENTED } from "../../utils/constants.js";
import { domainAssert } from "../errors/DomainError.js";
import { isDouble } from "../model/Domino.js";
import {
  getPlacementDomino,
  getPlacementPorts,
} from "./BoardPorts.js";
import {
  createPortUsageIndex,
  getConnectionsForPlacement,
} from "./BoardTopology.js";
import { validateBoardState } from "./BoardValidator.js";
import { parseSequentialId } from "./SequentialIds.js";

const SCORING_DIVISOR = 5;

const SCORING_TERM_REASONS = Object.freeze({
  OPEN_ORDINARY_SIDE: "OPEN_ORDINARY_SIDE",
  DOUBLE_WITH_AT_MOST_ONE_CONNECTION:
    "DOUBLE_WITH_AT_MOST_ONE_CONNECTION",
  DOUBLE_WITH_TWO_OR_MORE_CONNECTIONS:
    "DOUBLE_WITH_TWO_OR_MORE_CONNECTIONS",
});

export const SCORING_CAPABILITIES = Object.freeze({
  openEndSum: CAPABILITY_IMPLEMENTED,
  multipleOfFiveAward: CAPABILITY_IMPLEMENTED,
  traditionalWinBonus: CAPABILITY_IMPLEMENTED,
  blockedGameResult: CAPABILITY_IMPLEMENTED,
  finalResult: CAPABILITY_IMPLEMENTED,
});

export const PLAY_SCORING_READY = true;
export const SCORING_READY = true;

function comparePlacementIds(first, second) {
  return (
    parseSequentialId(first, "placement") -
    parseSequentialId(second, "placement")
  );
}

/**
 * Proyecta las fuentes explicables de S desde la topología actual.
 * Los chanchos producen un término agrupado; los demás, uno por lado abierto.
 */
export function getScoringTerms(state) {
  validateBoardState(state);
  const usage = createPortUsageIndex(state);
  const terms = [];

  for (const placementId of Object.keys(state.board.placements).sort(
    comparePlacementIds,
  )) {
    const domino = getPlacementDomino(state, placementId);
    const connectionCount = getConnectionsForPlacement(
      state,
      placementId,
    ).length;

    if (isDouble(domino)) {
      const contributes = connectionCount <= 1;
      terms.push({
        placementId,
        dominoId: domino.id,
        connectionCount,
        contribution: contributes ? domino.sides[0].value * 2 : 0,
        reason: contributes
          ? SCORING_TERM_REASONS.DOUBLE_WITH_AT_MOST_ONE_CONNECTION
          : SCORING_TERM_REASONS.DOUBLE_WITH_TWO_OR_MORE_CONNECTIONS,
      });
      continue;
    }

    for (const port of getPlacementPorts(state, placementId)) {
      if (usage.has(`${placementId}:${port.id}`)) {
        continue;
      }
      terms.push({
        placementId,
        dominoId: domino.id,
        portId: port.id,
        value: port.value,
        contribution: port.value,
        reason: SCORING_TERM_REASONS.OPEN_ORDINARY_SIDE,
      });
    }
  }

  return terms;
}

/** R-014: S se obtiene exclusivamente sumando getScoringTerms. */
export function calculateOpenEndsSum(state) {
  return getScoringTerms(state).reduce(
    (sum, term) => sum + term.contribution,
    0,
  );
}

/** R-015/R-016: política vigente fija para múltiplos de cinco. */
export function calculateMoveScore(openEndsSum) {
  domainAssert(
    Number.isSafeInteger(openEndsSum) && openEndsSum >= 0,
    "INVALID_OPEN_ENDS_SUM",
    "openEndsSum debe ser un entero no negativo.",
    { openEndsSum },
  );
  return openEndsSum % SCORING_DIVISOR === 0
    ? openEndsSum / SCORING_DIVISOR
    : 0;
}

/** R-023: redondeo reglamentario explícito del total rival dividido por 5. */
export function calculateFinalBonus(remainingPips) {
  domainAssert(
    Number.isSafeInteger(remainingPips) && remainingPips >= 0,
    "INVALID_REMAINING_PIPS",
    "remainingPips debe ser un entero no negativo.",
    { remainingPips },
  );
  const quotient = Math.floor(remainingPips / SCORING_DIVISOR);
  const remainder = remainingPips % SCORING_DIVISOR;
  return remainder <= 2 ? quotient : quotient + 1;
}
