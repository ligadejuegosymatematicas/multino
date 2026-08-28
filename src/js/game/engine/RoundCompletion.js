import { domainAssert } from "../errors/DomainError.js";
import { validateBoardState } from "./BoardValidator.js";
import { calculateFinalBonus } from "./Scoring.js";

export const ROUND_END_REASONS = Object.freeze({
  EMPTY_HAND: "EMPTY_HAND",
  BLOCKED: "BLOCKED",
});

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertTeamScoreMap(scoreByTeam, teamIds) {
  domainAssert(
    isRecord(scoreByTeam) &&
      Object.keys(scoreByTeam).length === teamIds.length &&
      teamIds.every(
        (teamId) =>
          Number.isSafeInteger(scoreByTeam[teamId]) &&
          scoreByTeam[teamId] >= 0,
      ),
    "INVALID_SCORE",
    "El puntaje previo debe contener un entero no negativo por equipo.",
    { scoreByTeam },
  );
}

/** R-021: suma los valores de todas las fichas que conserva cada equipo. */
export function calculateRemainingPipsByTeam(state) {
  validateBoardState(state);
  const teamIds = Object.keys(state.teams ?? {});
  domainAssert(
    teamIds.length === 2 &&
      isRecord(state.players) &&
      isRecord(state.hands),
    "INVALID_PARTICIPANTS",
    "El cierre requiere exactamente dos equipos y sus cuatro manos.",
  );

  const remainingPipsByTeam = Object.fromEntries(
    teamIds.map((teamId) => [teamId, 0]),
  );
  for (const [playerId, hand] of Object.entries(state.hands)) {
    const teamId = state.players[playerId]?.teamId;
    domainAssert(
      Object.hasOwn(remainingPipsByTeam, teamId),
      "INVALID_PLAYER_TEAM",
      "Cada mano debe pertenecer a un jugador de un equipo existente.",
      { playerId, teamId },
    );
    for (const dominoId of hand) {
      const domino = state.dominoes[dominoId];
      domainAssert(
        Array.isArray(domino?.sides) &&
          domino.sides.length === 2 &&
          domino.sides.every(
            (side) => Number.isSafeInteger(side?.value) && side.value >= 0,
          ),
        "INVALID_DOMINO",
        "Cada ficha restante debe conservar dos valores enteros no negativos.",
        { playerId, dominoId },
      );
      remainingPipsByTeam[teamId] +=
        domino.sides[0].value + domino.sides[1].value;
    }
  }
  return remainingPipsByTeam;
}

function determineTraditionalWinnerTeamId(
  state,
  reason,
  finishingPlayerId,
  remainingPipsByTeam,
) {
  if (reason === ROUND_END_REASONS.EMPTY_HAND) {
    const player = state.players[finishingPlayerId];
    domainAssert(
      player && state.hands[finishingPlayerId]?.length === 0,
      "INVALID_EMPTY_HAND_RESULT",
      "EMPTY_HAND requiere un jugador existente con la mano vacía.",
      { finishingPlayerId },
    );
    return player.teamId;
  }

  const [firstTeamId, secondTeamId] = Object.keys(remainingPipsByTeam);
  if (
    remainingPipsByTeam[firstTeamId] ===
    remainingPipsByTeam[secondTeamId]
  ) {
    return null;
  }
  return remainingPipsByTeam[firstTeamId] < remainingPipsByTeam[secondTeamId]
    ? firstTeamId
    : secondTeamId;
}

function determineRoundWinnerTeamId(finalScoreByTeam) {
  const [firstTeamId, secondTeamId] = Object.keys(finalScoreByTeam);
  if (finalScoreByTeam[firstTeamId] === finalScoreByTeam[secondTeamId]) {
    return null;
  }
  return finalScoreByTeam[firstTeamId] > finalScoreByTeam[secondTeamId]
    ? firstTeamId
    : secondTeamId;
}

/**
 * Deriva el resumen terminal y el marcador final desde manos y puntos de juego.
 * Se exporta para que transición y validador compartan una única regla.
 */
export function deriveRoundCompletion(
  state,
  { reason, finishingPlayerId = null, playScoreByTeam = state.score?.teams },
) {
  domainAssert(
    Object.values(ROUND_END_REASONS).includes(reason),
    "INVALID_ROUND_RESULT",
    "El motivo de cierre debe ser EMPTY_HAND o BLOCKED.",
    { reason },
  );
  const teamIds = Object.keys(state.teams);
  assertTeamScoreMap(playScoreByTeam, teamIds);
  const remainingPipsByTeam = calculateRemainingPipsByTeam(state);
  const traditionalWinnerTeamId = determineTraditionalWinnerTeamId(
    state,
    reason,
    finishingPlayerId,
    remainingPipsByTeam,
  );
  const losingTeamId = traditionalWinnerTeamId
    ? teamIds.find((teamId) => teamId !== traditionalWinnerTeamId)
    : null;
  const finalBonus = traditionalWinnerTeamId
    ? calculateFinalBonus(remainingPipsByTeam[losingTeamId])
    : 0;
  const finalScoreByTeam = structuredClone(playScoreByTeam);
  if (traditionalWinnerTeamId) {
    finalScoreByTeam[traditionalWinnerTeamId] += finalBonus;
  }
  const winnerTeamId = determineRoundWinnerTeamId(finalScoreByTeam);
  const commonResult = {
    traditionalWinnerTeamId,
    remainingPipsByTeam,
    finalBonus,
    winnerTeamId,
    isTie: winnerTeamId === null,
  };
  const roundResult =
    reason === ROUND_END_REASONS.EMPTY_HAND
      ? {
          reason,
          finishingPlayerId,
          finishingTeamId: state.players[finishingPlayerId].teamId,
          ...commonResult,
        }
      : { reason, ...commonResult };

  return { roundResult, finalScoreByTeam };
}
