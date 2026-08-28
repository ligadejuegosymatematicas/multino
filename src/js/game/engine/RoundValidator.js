import { STATE_SCHEMA_VERSION } from "../../utils/constants.js";
import { domainAssert } from "../errors/DomainError.js";
import { prepareParticipants } from "../setup/Participants.js";
import { getCounterclockwiseSuccessor } from "../setup/Seating.js";
import { STARTING_DOMINO_ID } from "../setup/StartingPlayer.js";
import { ACTION_TYPES } from "./ActionTypes.js";
import { validateBoardState } from "./BoardValidator.js";
import { getLegalPlays } from "./LegalPlays.js";
import {
  deriveRoundCompletion,
  ROUND_END_REASONS,
} from "./RoundCompletion.js";
import {
  calculateMoveScore,
  calculateOpenEndsSum,
} from "./Scoring.js";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactlyKeys(record, expectedKeys) {
  if (!isRecord(record)) {
    return false;
  }
  const actualKeys = Object.keys(record).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    expectedKeys
      .slice()
      .sort()
      .every((key, index) => key === actualKeys[index])
  );
}

function getStartingPlayerIdFromSnapshot(state) {
  const holder = Object.entries(state.hands).find(([, hand]) =>
    hand.includes(STARTING_DOMINO_ID),
  )?.[0];
  if (holder) {
    return holder;
  }

  return state.history.find(
    (entry) =>
      entry.type === ACTION_TYPES.PLAY_DOMINO &&
      entry.payload?.dominoId === STARTING_DOMINO_ID,
  )?.playerId;
}

function getTrailingPassCount(history) {
  let count = 0;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (history[index].type !== ACTION_TYPES.PASS) {
      break;
    }
    count += 1;
  }
  return count;
}

function assertParticipantsHandsAndScore(state) {
  domainAssert(
    isRecord(state.players) &&
      Object.entries(state.players).every(
        ([playerId, player]) => player?.id === playerId,
      ) &&
      isRecord(state.teams) &&
      Object.entries(state.teams).every(
        ([teamId, team]) => team?.id === teamId,
      ),
    "INVALID_PARTICIPANT_MAPS",
    "Las claves de players y teams deben coincidir con sus IDs.",
  );
  const participants = prepareParticipants({
    players: Object.values(state.players),
    teams: Object.values(state.teams),
    seating: state.seating,
  });
  const playerIds = Object.keys(participants.players);
  const teamIds = Object.keys(participants.teams);
  domainAssert(
    isRecord(state.hands) &&
      Object.keys(state.hands).length === playerIds.length &&
      playerIds.every((playerId) => Array.isArray(state.hands[playerId])),
    "INVALID_HANDS",
    "Debe existir exactamente una mano por participante.",
    { handPlayerIds: isRecord(state.hands) ? Object.keys(state.hands) : null },
  );
  domainAssert(
    isRecord(state.score?.teams) &&
      Object.keys(state.score.teams).length === teamIds.length &&
      teamIds.every(
        (teamId) =>
          Number.isSafeInteger(state.score.teams[teamId]) &&
          state.score.teams[teamId] >= 0,
      ),
    "INVALID_SCORE",
    "score.teams debe contener un entero no negativo por equipo.",
    { score: state.score },
  );
}

function assertPlayHistoryShape(entry) {
  const target = entry.payload?.target;
  const result = entry.result;
  const firstPlacement = result?.placementId === "placement-1";
  domainAssert(
    isRecord(entry.payload) &&
      typeof entry.payload.dominoId === "string" &&
      isRecord(target) &&
      hasExactlyKeys(result, [
        "placementId",
        "connectionId",
        "openEndsSum",
        "scoreAwarded",
      ]),
    "INVALID_PLAY_HISTORY",
    "Una acción PLAY_DOMINO debe conservar payload y result canónicos.",
    { entry },
  );
  domainAssert(
    Number.isSafeInteger(result.openEndsSum) &&
      result.openEndsSum >= 0 &&
      Number.isSafeInteger(result.scoreAwarded) &&
      result.scoreAwarded >= 0 &&
      result.scoreAwarded === calculateMoveScore(result.openEndsSum),
    "INVALID_PLAY_SCORING",
    "PLAY_DOMINO debe registrar S y los puntos compatibles con múltiplos de 5.",
    { entry },
  );

  if (firstPlacement) {
    domainAssert(
      hasExactlyKeys(target, ["kind"]) &&
        target.kind === "START" &&
        result.connectionId === null,
      "INVALID_PLAY_HISTORY",
      "La primera acción PLAY_DOMINO debe usar START y connectionId=null.",
      { entry },
    );
    return;
  }

  domainAssert(
    hasExactlyKeys(target, ["kind", "placementId", "portId"]) &&
      target.kind === "OPEN_END" &&
      typeof target.placementId === "string" &&
      typeof target.portId === "string" &&
      typeof result.connectionId === "string",
    "INVALID_PLAY_HISTORY",
    "Una acción PLAY_DOMINO posterior debe conservar su puerto objetivo.",
    { entry },
  );
}

function assertRegulatoryHistory(state) {
  const startingPlayerId = getStartingPlayerIdFromSnapshot(state);
  domainAssert(
    typeof startingPlayerId === "string" && state.players[startingPlayerId],
    "INVALID_STARTING_PLAYER",
    "El snapshot debe permitir identificar al poseedor original de 6-6.",
    { startingPlayerId },
  );

  let expectedPlayerId = startingPlayerId;
  const expectedScoreByTeam = Object.fromEntries(
    Object.keys(state.teams).map((teamId) => [teamId, 0]),
  );
  state.history.forEach((entry, index) => {
    domainAssert(
      entry.turn === index + 1 && entry.sequence === index + 1,
      "INVALID_REGULATORY_HISTORY_TURN",
      "Cada acción reglamentaria debe usar una secuencia y turno únicos desde 1.",
      { entry, index },
    );
    domainAssert(
      entry.playerId === expectedPlayerId,
      "INVALID_REGULATORY_HISTORY_PLAYER",
      "El historial debe respetar el ciclo antihorario de jugadores.",
      { entry, expectedPlayerId },
    );

    if (entry.type === ACTION_TYPES.PLAY_DOMINO) {
      assertPlayHistoryShape(entry);
      const teamId = state.players[entry.playerId].teamId;
      expectedScoreByTeam[teamId] += entry.result.scoreAwarded;
    } else {
      domainAssert(
        entry.type === ACTION_TYPES.PASS &&
          hasExactlyKeys(entry.payload, []) &&
          hasExactlyKeys(entry.result, []),
        "INVALID_PASS_HISTORY",
        "Una acción PASS debe conservar payload y result vacíos.",
        { entry },
      );
    }

    expectedPlayerId = getCounterclockwiseSuccessor(
      state.seating,
      expectedPlayerId,
    );
  });

  const lastPlay = state.history.findLast(
    (entry) => entry.type === ACTION_TYPES.PLAY_DOMINO,
  );
  if (lastPlay) {
    const currentOpenEndsSum = calculateOpenEndsSum(state);
    domainAssert(
      lastPlay.result.openEndsSum === currentOpenEndsSum,
      "OPEN_ENDS_SUM_MISMATCH",
      "El S de la última jugada debe coincidir con el tablero actual.",
      {
        recordedOpenEndsSum: lastPlay.result.openEndsSum,
        currentOpenEndsSum,
      },
    );
  }

  return { expectedPlayerId, playScoreByTeam: expectedScoreByTeam };
}

function assertScoreMatches(actualScoreByTeam, expectedScoreByTeam, code) {
  domainAssert(
    Object.keys(expectedScoreByTeam).every(
      (teamId) => actualScoreByTeam[teamId] === expectedScoreByTeam[teamId],
    ),
    code,
    "El marcador no coincide con sus componentes reglamentarios.",
    { actualScoreByTeam, expectedScoreByTeam },
  );
}

function assertRemainingPipsMatch(state, expectedRemainingPipsByTeam) {
  const actual = state.roundResult.remainingPipsByTeam;
  const teamIds = Object.keys(state.teams);
  domainAssert(
    isRecord(actual) &&
      Object.keys(actual).length === teamIds.length &&
      teamIds.every(
        (teamId) =>
          Number.isSafeInteger(actual[teamId]) &&
          actual[teamId] >= 0 &&
          actual[teamId] === expectedRemainingPipsByTeam[teamId],
      ),
    "INVALID_REMAINING_PIPS",
    "remainingPipsByTeam debe coincidir exactamente con las manos terminales.",
    { actual, expectedRemainingPipsByTeam },
  );
}

function assertTerminalResult(state, playScoreByTeam) {
  const result = state.roundResult;
  domainAssert(
    isRecord(result) &&
      Object.values(ROUND_END_REASONS).includes(result.reason),
    "INVALID_ROUND_RESULT",
    "Una ronda terminada debe declarar un motivo válido.",
    { roundResult: result },
  );

  const lastEntry = state.history.at(-1);
  domainAssert(
    lastEntry && state.currentPlayerId === lastEntry.playerId,
    "INVALID_TERMINAL_CURRENT_PLAYER",
    "El snapshot terminal conserva como currentPlayerId al actor terminal.",
    { currentPlayerId: state.currentPlayerId, lastEntry },
  );

  if (result.reason === ROUND_END_REASONS.EMPTY_HAND) {
    domainAssert(
      hasExactlyKeys(result, [
        "reason",
        "finishingPlayerId",
        "finishingTeamId",
        "traditionalWinnerTeamId",
        "remainingPipsByTeam",
        "finalBonus",
        "winnerTeamId",
        "isTie",
      ]),
      "INVALID_EMPTY_HAND_RESULT",
      "EMPTY_HAND debe conservar la forma terminal canónica.",
      { roundResult: result },
    );
    const player = state.players[result.finishingPlayerId];
    domainAssert(
      player &&
        result.finishingPlayerId === lastEntry.playerId &&
        result.finishingPlayerId === state.currentPlayerId &&
        result.finishingTeamId === player.teamId &&
        state.teams[result.finishingTeamId] &&
        state.hands[result.finishingPlayerId]?.length === 0 &&
        state.consecutivePasses === 0 &&
        lastEntry.type === ACTION_TYPES.PLAY_DOMINO,
      "INVALID_EMPTY_HAND_RESULT",
      "EMPTY_HAND debe corresponder a la última ficha del actor terminal.",
      { roundResult: result, lastEntry },
    );
    const emptyHands = Object.entries(state.hands)
      .filter(([, hand]) => hand.length === 0)
      .map(([playerId]) => playerId);
    domainAssert(
      emptyHands.length === 1 && emptyHands[0] === result.finishingPlayerId,
      "INVALID_EMPTY_HAND_RESULT",
      "Solo el jugador de salida puede tener la mano vacía.",
      { emptyHands, roundResult: result },
    );
  } else {
    domainAssert(
      hasExactlyKeys(result, [
        "reason",
        "traditionalWinnerTeamId",
        "remainingPipsByTeam",
        "finalBonus",
        "winnerTeamId",
        "isTie",
      ]) &&
        state.consecutivePasses === 4 &&
        lastEntry.type === ACTION_TYPES.PASS &&
        Object.values(state.hands).every((hand) => hand.length > 0),
      "INVALID_BLOCKED_RESULT",
      "BLOCKED requiere cuatro pases, manos no vacías y resultado canónico.",
      { roundResult: result, consecutivePasses: state.consecutivePasses },
    );
  }

  const expected = deriveRoundCompletion(state, {
    reason: result.reason,
    finishingPlayerId:
      result.reason === ROUND_END_REASONS.EMPTY_HAND
        ? result.finishingPlayerId
        : null,
    playScoreByTeam,
  });
  assertRemainingPipsMatch(
    state,
    expected.roundResult.remainingPipsByTeam,
  );
  domainAssert(
    result.traditionalWinnerTeamId ===
      expected.roundResult.traditionalWinnerTeamId,
    "INVALID_TRADITIONAL_WINNER",
    "traditionalWinnerTeamId no coincide con salida o menor suma restante.",
    {
      actual: result.traditionalWinnerTeamId,
      expected: expected.roundResult.traditionalWinnerTeamId,
    },
  );
  domainAssert(
    Number.isSafeInteger(result.finalBonus) &&
      result.finalBonus >= 0 &&
      result.finalBonus === expected.roundResult.finalBonus,
    "INVALID_FINAL_BONUS",
    "finalBonus no coincide con el redondeo reglamentario del total rival.",
    { actual: result.finalBonus, expected: expected.roundResult.finalBonus },
  );
  assertScoreMatches(
    state.score.teams,
    expected.finalScoreByTeam,
    "FINAL_SCORE_MISMATCH",
  );
  domainAssert(
    typeof result.isTie === "boolean" &&
      result.isTie === expected.roundResult.isTie &&
      result.winnerTeamId === expected.roundResult.winnerTeamId,
    "INVALID_ROUND_WINNER",
    "winnerTeamId e isTie deben coincidir con el marcador final.",
    {
      winnerTeamId: result.winnerTeamId,
      isTie: result.isTie,
      expectedWinnerTeamId: expected.roundResult.winnerTeamId,
      expectedIsTie: expected.roundResult.isTie,
    },
  );
}

/** Valida el estado reglamentario de una ronda activa o terminada. */
export function validateRoundState(state) {
  validateBoardState(state);
  domainAssert(
    state.schemaVersion === STATE_SCHEMA_VERSION,
    "INVALID_SCHEMA_VERSION",
    `schemaVersion debe ser ${STATE_SCHEMA_VERSION}.`,
    { schemaVersion: state.schemaVersion },
  );
  assertParticipantsHandsAndScore(state);
  domainAssert(
    typeof state.currentPlayerId === "string" &&
      state.players[state.currentPlayerId] &&
      Array.isArray(state.hands[state.currentPlayerId]),
    "INVALID_CURRENT_PLAYER",
    "currentPlayerId debe identificar a un jugador con mano existente.",
    { currentPlayerId: state.currentPlayerId },
  );
  domainAssert(
    Number.isSafeInteger(state.turnNumber) && state.turnNumber >= 1,
    "INVALID_TURN_NUMBER",
    "turnNumber debe ser un entero positivo.",
    { turnNumber: state.turnNumber },
  );
  domainAssert(
    Number.isSafeInteger(state.consecutivePasses) &&
      state.consecutivePasses >= 0 &&
      state.consecutivePasses <= 4,
    "INVALID_CONSECUTIVE_PASSES",
    "consecutivePasses debe estar entre 0 y 4.",
    { consecutivePasses: state.consecutivePasses },
  );

  const { expectedPlayerId: nextPlayerId, playScoreByTeam } =
    assertRegulatoryHistory(state);
  const trailingPasses = getTrailingPassCount(state.history);
  domainAssert(
    state.consecutivePasses === trailingPasses,
    "INVALID_CONSECUTIVE_PASSES",
    "consecutivePasses debe coincidir con los PASS consecutivos del historial.",
    { consecutivePasses: state.consecutivePasses, trailingPasses },
  );
  const trailingPassEntries =
    trailingPasses === 0 ? [] : state.history.slice(-trailingPasses);
  for (const passEntry of trailingPassEntries) {
    domainAssert(
      getLegalPlays(state, passEntry.playerId).length === 0,
      "INVALID_PASS_HISTORY",
      "Cada PASS consecutivo debe corresponder a una mano sin jugadas legales.",
      { passEntry },
    );
  }

  if (state.board.mainLine.placementIds.length === 0) {
    domainAssert(
      state.history.length === 0,
      "INVALID_EMPTY_BOARD_HISTORY",
      "Un tablero vacío no puede contener acciones reglamentarias.",
      { historyLength: state.history.length },
    );
  }

  if (state.phase === "playing") {
    domainAssert(
      !Object.hasOwn(state, "roundResult"),
      "UNEXPECTED_ROUND_RESULT",
      "Una ronda activa no puede contener roundResult.",
    );
    domainAssert(
      state.consecutivePasses < 4 &&
        state.turnNumber === state.history.length + 1 &&
        state.currentPlayerId === nextPlayerId &&
        Object.values(state.hands).every((hand) => hand.length > 0),
      "INVALID_PLAYING_ROUND_STATE",
      "El estado activo no coincide con su siguiente turno reglamentario.",
      {
        turnNumber: state.turnNumber,
        historyLength: state.history.length,
        currentPlayerId: state.currentPlayerId,
        expectedPlayerId: nextPlayerId,
      },
    );
    assertScoreMatches(
      state.score.teams,
      playScoreByTeam,
      "SCORE_HISTORY_MISMATCH",
    );
    return state;
  }

  domainAssert(
    state.phase === "finished" &&
      state.history.length > 0 &&
      state.turnNumber === state.history.length,
    "INVALID_FINISHED_ROUND_STATE",
    "El estado terminal conserva el número de la acción que terminó la ronda.",
    { turnNumber: state.turnNumber, historyLength: state.history.length },
  );
  assertTerminalResult(state, playScoreByTeam);
  return state;
}
