import { STATE_SCHEMA_VERSION } from "../../utils/constants.js";
import { createEmptyBoard } from "./Board.js";

/**
 * Estado técnico vacío, previo a una partida configurada.
 * No reparte fichas, elige jugador ni asigna puntuación.
 */
export function createEmptyGameState(config = {}) {
  const specialMainLineDoublesLimit =
    config.specialMainLineDoublesLimit ?? null;

  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    matchId: null,
    phase: "setup",
    turnNumber: 0,
    currentPlayerId: null,
    consecutivePasses: 0,
    teams: {},
    players: {},
    seating: {
      counterclockwisePlayerIds: [],
    },
    dominoes: {},
    hands: {},
    board: createEmptyBoard(),
    score: {
      teams: {},
    },
    config: {
      ...config,
      specialMainLineDoublesLimit,
    },
    history: [],
  };
}
