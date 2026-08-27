import { domainAssert } from "../errors/DomainError.js";
import { createDominoId } from "../model/Domino.js";

export const STARTING_DOMINO_ID = createDominoId(6, 6);

/** R-007: identifica al único poseedor de 6-6. */
export function findStartingPlayerId(hands) {
  domainAssert(
    hands !== null && typeof hands === "object" && !Array.isArray(hands),
    "INVALID_HANDS",
    "hands debe ser un objeto indexado por jugador.",
    { hands },
  );
  domainAssert(
    Object.values(hands).every((dominoIds) => Array.isArray(dominoIds)),
    "INVALID_HANDS",
    "Cada mano debe ser un array de IDs de ficha.",
    { hands },
  );

  const holders = Object.entries(hands)
    .filter(([, dominoIds]) =>
      Array.isArray(dominoIds) && dominoIds.includes(STARTING_DOMINO_ID),
    )
    .map(([playerId]) => playerId);

  domainAssert(
    holders.length === 1,
    "INVALID_STARTING_DOMINO_LOCATION",
    "La ficha 6-6 debe pertenecer exactamente a una mano.",
    { holders },
  );

  return holders[0];
}
