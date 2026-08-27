import { domainAssert } from "../errors/DomainError.js";
import { DOUBLE_SIX_DOMINO_COUNT } from "../model/Domino.js";

/**
 * R-006/R-029: reparte circularmente la secuencia ya mezclada siguiendo el
 * orden antihorario de asientos: índice i → asiento i mod 4.
 */
export function dealRoundRobin(shuffledDominoIds, seating) {
  domainAssert(
    Array.isArray(shuffledDominoIds) &&
      shuffledDominoIds.length === DOUBLE_SIX_DOMINO_COUNT,
    "INVALID_DEAL_DOMINO_COUNT",
    "El reparto requiere una secuencia mezclada de 28 fichas.",
    {
      count: Array.isArray(shuffledDominoIds)
        ? shuffledDominoIds.length
        : null,
    },
  );
  domainAssert(
    new Set(shuffledDominoIds).size === DOUBLE_SIX_DOMINO_COUNT,
    "DUPLICATE_DEAL_DOMINO",
    "La secuencia de reparto contiene fichas duplicadas.",
  );

  const playerIds = seating?.counterclockwisePlayerIds;
  domainAssert(
    Array.isArray(playerIds) &&
      playerIds.length === 4 &&
      new Set(playerIds).size === 4,
    "INVALID_DEAL_SEATING",
    "El reparto requiere cuatro asientos únicos en orden antihorario.",
    { seating },
  );

  const hands = Object.fromEntries(playerIds.map((playerId) => [playerId, []]));
  shuffledDominoIds.forEach((dominoId, index) => {
    const playerId = playerIds[index % playerIds.length];
    hands[playerId].push(dominoId);
  });

  return hands;
}

