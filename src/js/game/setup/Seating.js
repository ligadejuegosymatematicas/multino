import { domainAssert } from "../errors/DomainError.js";

function getPlayerIds(seating) {
  const playerIds = seating?.counterclockwisePlayerIds;
  domainAssert(
    Array.isArray(playerIds) &&
      playerIds.length === 4 &&
      new Set(playerIds).size === 4,
    "INVALID_SEATING",
    "seating.counterclockwisePlayerIds debe contener cuatro jugadores únicos.",
    { seating },
  );

  return playerIds;
}

/** R-009: sucesor en el ciclo antihorario, sin avanzar un turno. */
export function getCounterclockwiseSuccessor(seating, playerId) {
  const playerIds = getPlayerIds(seating);
  const playerIndex = playerIds.indexOf(playerId);

  domainAssert(
    playerIndex >= 0,
    "UNKNOWN_SEATED_PLAYER",
    `El jugador ${String(playerId)} no pertenece al orden de asientos.`,
    { playerId },
  );

  return playerIds[(playerIndex + 1) % playerIds.length];
}
