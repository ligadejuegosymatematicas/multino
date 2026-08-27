import { STATE_SCHEMA_VERSION } from "../../utils/constants.js";
import { domainAssert } from "../errors/DomainError.js";
import {
  DOUBLE_SIX_DOMINO_COUNT,
  generateDoubleSixSet,
} from "../model/Domino.js";
import { validateSpecialDoubleLimit } from "./MatchConfig.js";
import { prepareParticipants } from "./Participants.js";
import {
  STARTING_DOMINO_ID,
  findStartingPlayerId,
} from "./StartingPlayer.js";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertInitialDominoCatalog(dominoes) {
  domainAssert(
    isRecord(dominoes) && Object.keys(dominoes).length === DOUBLE_SIX_DOMINO_COUNT,
    "INVALID_DOMINO_CATALOG",
    "El catálogo inicial debe contener exactamente 28 fichas.",
    { count: isRecord(dominoes) ? Object.keys(dominoes).length : null },
  );

  const expected = generateDoubleSixSet();
  for (const expectedDomino of expected) {
    const actual = dominoes[expectedDomino.id];
    domainAssert(
      actual?.id === expectedDomino.id &&
        !Object.hasOwn(actual, "isDouble") &&
        Array.isArray(actual.sides) &&
        actual.sides.length === 2 &&
        actual.sides[0]?.id === "a" &&
        actual.sides[1]?.id === "b" &&
        actual.sides[0]?.value === expectedDomino.sides[0].value &&
        actual.sides[1]?.value === expectedDomino.sides[1].value,
      "INVALID_DOMINO_CATALOG",
      `La ficha ${expectedDomino.id} falta o no coincide con R-005.`,
      { dominoId: expectedDomino.id, actual },
    );
  }
}

function assertInitialHands(hands, playerIds, dominoIds) {
  domainAssert(
    isRecord(hands) &&
      Object.keys(hands).length === playerIds.length &&
      playerIds.every((playerId) => Object.hasOwn(hands, playerId)),
    "INVALID_HANDS",
    "Debe existir exactamente una mano por jugador.",
    { handPlayerIds: isRecord(hands) ? Object.keys(hands) : null },
  );

  for (const playerId of playerIds) {
    domainAssert(
      Array.isArray(hands[playerId]) && hands[playerId].length === 7,
      "INVALID_HAND_SIZE",
      `La mano de ${playerId} debe contener exactamente siete fichas.`,
      {
        playerId,
        count: Array.isArray(hands[playerId]) ? hands[playerId].length : null,
      },
    );
  }

  const locatedIds = playerIds.flatMap((playerId) => hands[playerId]);
  const catalogIds = new Set(dominoIds);
  domainAssert(
    locatedIds.length === DOUBLE_SIX_DOMINO_COUNT &&
      new Set(locatedIds).size === DOUBLE_SIX_DOMINO_COUNT &&
      locatedIds.every((dominoId) => catalogIds.has(dominoId)),
    "INVALID_DOMINO_LOCATION",
    "Las 28 fichas deben aparecer exactamente una vez entre las cuatro manos.",
    { locatedIds },
  );
}

function assertEmptyInitialBoard(board) {
  const valid =
    isRecord(board) &&
    isRecord(board.placements) &&
    Object.keys(board.placements).length === 0 &&
    isRecord(board.connections) &&
    Object.keys(board.connections).length === 0 &&
    isRecord(board.mainLine) &&
    Array.isArray(board.mainLine.placementIds) &&
    board.mainLine.placementIds.length === 0 &&
    Array.isArray(board.specialDoublePlacementIds) &&
    board.specialDoublePlacementIds.length === 0 &&
    !Object.hasOwn(board, "branches");

  domainAssert(
    valid,
    "INITIAL_BOARD_NOT_EMPTY",
    "El tablero inicial debe estar vacío y respetar el esquema v3.",
    { board },
  );
}

function assertInitialScore(score, teamIds) {
  domainAssert(
    isRecord(score?.teams) &&
      Object.keys(score.teams).length === teamIds.length &&
      teamIds.every(
        (teamId) =>
          Object.hasOwn(score.teams, teamId) && score.teams[teamId] === 0,
      ),
    "INVALID_INITIAL_SCORE",
    "El marcador inicial debe contener exactamente ambos equipos en cero.",
    { score },
  );
}

/**
 * Valida únicamente el snapshot inicial de este bloque de Fase 1.
 * Devuelve el mismo snapshot y no lo modifica.
 */
export function validateInitialMatchSnapshot(snapshot) {
  domainAssert(
    isRecord(snapshot),
    "INVALID_SNAPSHOT",
    "El snapshot inicial debe ser un objeto.",
  );
  domainAssert(
    snapshot.schemaVersion === STATE_SCHEMA_VERSION,
    "INVALID_SCHEMA_VERSION",
    `schemaVersion debe ser ${STATE_SCHEMA_VERSION}.`,
    { schemaVersion: snapshot.schemaVersion },
  );
  domainAssert(
    snapshot.phase === "playing" && snapshot.turnNumber === 1,
    "INVALID_INITIAL_PHASE",
    "La partida inicializada debe estar en phase=playing y turnNumber=1.",
    { phase: snapshot.phase, turnNumber: snapshot.turnNumber },
  );
  domainAssert(
    snapshot.consecutivePasses === 0,
    "INVALID_INITIAL_PASSES",
    "consecutivePasses debe comenzar en cero.",
    { consecutivePasses: snapshot.consecutivePasses },
  );
  domainAssert(
    !Object.hasOwn(snapshot, "stock"),
    "UNEXPECTED_STOCK",
    "El snapshot no puede contener stock ni pozo.",
  );

  domainAssert(
    isRecord(snapshot.players) &&
      Object.entries(snapshot.players).every(
        ([playerId, player]) => player?.id === playerId,
      ),
    "INVALID_PLAYER_MAP",
    "Cada clave de players debe coincidir con player.id.",
    { players: snapshot.players },
  );
  domainAssert(
    isRecord(snapshot.teams) &&
      Object.entries(snapshot.teams).every(
        ([teamId, team]) => team?.id === teamId,
      ),
    "INVALID_TEAM_MAP",
    "Cada clave de teams debe coincidir con team.id.",
    { teams: snapshot.teams },
  );

  const preparedParticipants = prepareParticipants({
    players: isRecord(snapshot.players) ? Object.values(snapshot.players) : null,
    teams: isRecord(snapshot.teams) ? Object.values(snapshot.teams) : null,
    seating: snapshot.seating,
  });
  const playerIds = preparedParticipants.seating.counterclockwisePlayerIds;
  const teamIds = Object.keys(preparedParticipants.teams);

  validateSpecialDoubleLimit(snapshot.config?.specialMainLineDoublesLimit);
  assertInitialDominoCatalog(snapshot.dominoes);
  assertInitialHands(snapshot.hands, playerIds, Object.keys(snapshot.dominoes));
  assertEmptyInitialBoard(snapshot.board);
  assertInitialScore(snapshot.score, teamIds);

  const startingPlayerId = findStartingPlayerId(snapshot.hands);
  domainAssert(
    snapshot.currentPlayerId === startingPlayerId &&
      snapshot.hands[snapshot.currentPlayerId].includes(STARTING_DOMINO_ID),
    "INVALID_STARTING_PLAYER",
    "currentPlayerId debe identificar al poseedor de 6-6.",
    {
      currentPlayerId: snapshot.currentPlayerId,
      expectedPlayerId: startingPlayerId,
    },
  );
  domainAssert(
    Array.isArray(snapshot.history) && snapshot.history.length === 0,
    "INVALID_INITIAL_HISTORY",
    "La partida recién creada debe comenzar con history vacío.",
    { history: snapshot.history },
  );

  try {
    JSON.stringify(snapshot);
  } catch (error) {
    domainAssert(false, "NON_SERIALIZABLE_SNAPSHOT", "El snapshot no es serializable a JSON.", {
      cause: error.message,
    });
  }

  return snapshot;
}
