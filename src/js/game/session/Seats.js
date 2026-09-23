import { domainAssert } from "../errors/DomainError.js";

export const SEAT_CONTROL_TYPES = Object.freeze({
  HUMAN: "HUMAN",
  CPU: "CPU",
});

export const SEAT_CONNECTION_STATES = Object.freeze({
  LOCAL: "LOCAL",
  CONNECTED: "CONNECTED",
  DISCONNECTED: "DISCONNECTED",
});

export const CPU_DIFFICULTIES = Object.freeze({ V1: "V1" });

const TEAM_BY_INDEX = Object.freeze(["A", "B", "A", "B"]);

function normalizeNick(value, fallback) {
  const nick = typeof value === "string" ? value.trim() : "";
  return nick || fallback;
}

export function createSeat({
  seatIndex,
  controlType = SEAT_CONTROL_TYPES.HUMAN,
  playerId = null,
  nick = null,
  connectionState = SEAT_CONNECTION_STATES.LOCAL,
  cpuDifficulty = CPU_DIFFICULTIES.V1,
} = {}) {
  domainAssert(
    Number.isInteger(seatIndex) && seatIndex >= 0 && seatIndex < 4,
    "INVALID_SEAT_INDEX",
    "seatIndex debe estar entre 0 y 3.",
    { seatIndex },
  );
  domainAssert(
    Object.values(SEAT_CONTROL_TYPES).includes(controlType),
    "INVALID_SEAT_CONTROL",
    "controlType debe ser HUMAN o CPU.",
    { controlType },
  );
  const seatNumber = seatIndex + 1;
  return {
    seatId: `seat-${seatNumber}`,
    seatIndex,
    teamId: TEAM_BY_INDEX[seatIndex],
    controlType,
    playerId: controlType === SEAT_CONTROL_TYPES.HUMAN
      ? playerId ?? `local-player-${seatNumber}`
      : null,
    nick: normalizeNick(
      nick,
      controlType === SEAT_CONTROL_TYPES.CPU ? `CPU ${seatNumber}` : `Jugador ${seatNumber}`,
    ),
    connectionState,
    cpuDifficulty: controlType === SEAT_CONTROL_TYPES.CPU
      ? cpuDifficulty
      : null,
  };
}

export function validateSeats(seats) {
  domainAssert(
    Array.isArray(seats) && seats.length === 4,
    "INVALID_SEAT_COUNT",
    "La mesa requiere exactamente cuatro asientos.",
    { count: Array.isArray(seats) ? seats.length : null },
  );
  const normalized = seats
    .map((seat, seatIndex) => createSeat({ ...seat, seatIndex }))
    .sort((first, second) => first.seatIndex - second.seatIndex);
  domainAssert(
    new Set(normalized.map((seat) => seat.seatId)).size === 4,
    "DUPLICATE_SEATS",
    "Los cuatro asientos deben ser únicos.",
  );
  const humanCount = normalized.filter(
    (seat) => seat.controlType === SEAT_CONTROL_TYPES.HUMAN,
  ).length;
  domainAssert(
    humanCount >= 1,
    "HUMAN_SEAT_REQUIRED",
    "La mesa necesita al menos un jugador humano.",
  );
  return normalized;
}

export function createDefaultSeats({ humanCount = 1, nick = "Jugador 1" } = {}) {
  domainAssert(
    Number.isInteger(humanCount) && humanCount >= 1 && humanCount <= 4,
    "INVALID_HUMAN_COUNT",
    "humanCount debe estar entre 1 y 4.",
    { humanCount },
  );
  return validateSeats(Array.from({ length: 4 }, (_, seatIndex) => createSeat({
    seatIndex,
    controlType: seatIndex < humanCount
      ? SEAT_CONTROL_TYPES.HUMAN
      : SEAT_CONTROL_TYPES.CPU,
    nick: seatIndex === 0 && humanCount > 0 ? nick : null,
  })));
}

export function participantsFromSeats(seats) {
  const normalized = validateSeats(seats);
  const players = normalized.map((seat) => ({
    id: seat.seatId,
    teamId: seat.teamId,
    displayName: seat.nick,
  }));
  return {
    players,
    teams: [
      {
        id: "A",
        playerIds: normalized.filter((seat) => seat.teamId === "A").map((seat) => seat.seatId),
        displayName: "Equipo A",
      },
      {
        id: "B",
        playerIds: normalized.filter((seat) => seat.teamId === "B").map((seat) => seat.seatId),
        displayName: "Equipo B",
      },
    ],
    seating: {
      counterclockwisePlayerIds: normalized.map((seat) => seat.seatId),
    },
  };
}

export function seatsFromParticipants(participants) {
  const playerIds = participants?.seating?.counterclockwisePlayerIds;
  domainAssert(
    Array.isArray(playerIds) && playerIds.length === 4,
    "INVALID_SEATING",
    "La mesa local requiere cuatro jugadores ordenados.",
  );
  return validateSeats(playerIds.map((playerId, seatIndex) => {
    const player = participants.players.find((candidate) => candidate.id === playerId);
    return createSeat({
      seatIndex,
      playerId,
      nick: player?.displayName ?? playerId,
    });
  }));
}

export function seatForPlayerId(seats, playerId) {
  return validateSeats(seats).find((seat) => seat.seatId === playerId) ?? null;
}
