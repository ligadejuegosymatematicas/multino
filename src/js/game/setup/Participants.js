import { domainAssert } from "../errors/DomainError.js";
import { createPlayer } from "../model/Player.js";
import { createTeam } from "../model/Team.js";

function assertUniqueIds(items, code, label) {
  const ids = items.map((item) => item?.id);
  domainAssert(
    ids.every((id) => typeof id === "string" && id.trim() !== ""),
    code,
    `Todos los ${label} deben tener un ID no vacío.`,
    { ids },
  );
  domainAssert(
    new Set(ids).size === ids.length,
    code,
    `Los IDs de ${label} deben ser únicos.`,
    { ids },
  );
}

/** R-003, R-004 y representación de R-009. */
export function prepareParticipants({ players, teams, seating }) {
  domainAssert(
    Array.isArray(players) && players.length === 4,
    "INVALID_PLAYER_COUNT",
    "La partida requiere exactamente cuatro jugadores.",
    { count: Array.isArray(players) ? players.length : null },
  );
  domainAssert(
    Array.isArray(teams) && teams.length === 2,
    "INVALID_TEAM_COUNT",
    "La partida requiere exactamente dos equipos.",
    { count: Array.isArray(teams) ? teams.length : null },
  );

  assertUniqueIds(players, "INVALID_PLAYER_IDS", "jugadores");
  assertUniqueIds(teams, "INVALID_TEAM_IDS", "equipos");

  for (const team of teams) {
    domainAssert(
      Array.isArray(team.playerIds),
      "INVALID_TEAM_PLAYERS",
      `El equipo ${team.id} debe declarar playerIds como array.`,
      { teamId: team.id, playerIds: team.playerIds },
    );
  }

  const normalizedPlayers = players.map((player) =>
    createPlayer({
      id: player.id,
      teamId: player.teamId,
      displayName: player.displayName ?? null,
    }),
  );
  const normalizedTeams = teams.map((team) =>
    createTeam({
      id: team.id,
      playerIds: team.playerIds,
      displayName: team.displayName ?? null,
    }),
  );

  const playerIds = new Set(normalizedPlayers.map((player) => player.id));
  const teamIds = new Set(normalizedTeams.map((team) => team.id));
  const membershipCount = new Map(
    normalizedPlayers.map((player) => [player.id, 0]),
  );

  for (const team of normalizedTeams) {
    domainAssert(
      team.playerIds.length === 2 && new Set(team.playerIds).size === 2,
      "INVALID_TEAM_SIZE",
      `El equipo ${team.id} debe contener exactamente dos jugadores distintos.`,
      { teamId: team.id, playerIds: team.playerIds },
    );

    for (const playerId of team.playerIds) {
      domainAssert(
        playerIds.has(playerId),
        "UNKNOWN_TEAM_PLAYER",
        `El equipo ${team.id} referencia al jugador inexistente ${playerId}.`,
        { teamId: team.id, playerId },
      );
      membershipCount.set(playerId, membershipCount.get(playerId) + 1);
    }
  }

  for (const player of normalizedPlayers) {
    domainAssert(
      teamIds.has(player.teamId),
      "UNKNOWN_PLAYER_TEAM",
      `El jugador ${player.id} referencia un equipo inexistente.`,
      { playerId: player.id, teamId: player.teamId },
    );
    domainAssert(
      membershipCount.get(player.id) === 1,
      "INVALID_TEAM_MEMBERSHIP",
      `El jugador ${player.id} debe pertenecer exactamente a un equipo.`,
      { playerId: player.id, count: membershipCount.get(player.id) },
    );

    const declaredTeam = normalizedTeams.find((team) =>
      team.playerIds.includes(player.id),
    );
    domainAssert(
      declaredTeam.id === player.teamId,
      "INCONSISTENT_TEAM_MEMBERSHIP",
      `La pertenencia del jugador ${player.id} no coincide entre Player y Team.`,
      {
        playerId: player.id,
        playerTeamId: player.teamId,
        teamPlayerIdsTeamId: declaredTeam.id,
      },
    );
  }

  const seatedIds = seating?.counterclockwisePlayerIds;
  domainAssert(
    Array.isArray(seatedIds) &&
      seatedIds.length === 4 &&
      new Set(seatedIds).size === 4 &&
      seatedIds.every((playerId) => playerIds.has(playerId)),
    "INVALID_SEATING",
    "Los asientos deben contener exactamente una vez a los cuatro jugadores.",
    { seating },
  );

  const playersById = Object.fromEntries(
    normalizedPlayers.map((player) => [player.id, player]),
  );
  for (let index = 0; index < seatedIds.length; index += 1) {
    const current = playersById[seatedIds[index]];
    const next = playersById[seatedIds[(index + 1) % seatedIds.length]];
    domainAssert(
      current.teamId !== next.teamId,
      "NON_ALTERNATING_TEAMS",
      "Los compañeros deben alternarse en el ciclo de asientos.",
      { currentPlayerId: current.id, nextPlayerId: next.id },
    );
  }

  return {
    players: playersById,
    teams: Object.fromEntries(
      normalizedTeams.map((team) => [team.id, team]),
    ),
    seating: {
      counterclockwisePlayerIds: [...seatedIds],
    },
  };
}

