import { createEmptyGameState } from "../model/GameState.js";
import { generateDoubleSixSet } from "../model/Domino.js";
import { dealRoundRobin } from "./Deal.js";
import { validateInitialMatchSnapshot } from "./InitialStateValidator.js";
import { validateSpecialDoubleLimit } from "./MatchConfig.js";
import { prepareParticipants } from "./Participants.js";
import { shuffle } from "./Shuffle.js";
import { findStartingPlayerId } from "./StartingPlayer.js";

export const MATCH_SETUP_READY = true;

/**
 * Crea atómicamente una partida preparada para el primer turno.
 * Transición técnica: setup → playing. No registra eventos sintéticos.
 */
export function createMatch({
  matchId = null,
  players,
  teams,
  seating,
  K,
  randomSource = Math.random,
} = {}) {
  const specialMainLineDoublesLimit = validateSpecialDoubleLimit(K);
  const participants = prepareParticipants({ players, teams, seating });
  const dominoList = generateDoubleSixSet();
  const dominoes = Object.fromEntries(
    dominoList.map((domino) => [domino.id, domino]),
  );
  const shuffledDominoIds = shuffle(
    dominoList.map((domino) => domino.id),
    randomSource,
  );
  const hands = dealRoundRobin(shuffledDominoIds, participants.seating);
  const currentPlayerId = findStartingPlayerId(hands);

  const snapshot = createEmptyGameState({ specialMainLineDoublesLimit });
  snapshot.matchId = matchId;
  snapshot.phase = "playing";
  snapshot.turnNumber = 1;
  snapshot.currentPlayerId = currentPlayerId;
  snapshot.players = participants.players;
  snapshot.teams = participants.teams;
  snapshot.seating = participants.seating;
  snapshot.dominoes = dominoes;
  snapshot.hands = hands;
  snapshot.score.teams = Object.fromEntries(
    Object.keys(participants.teams).map((teamId) => [teamId, 0]),
  );

  return validateInitialMatchSnapshot(snapshot);
}
