import {
  PROJECT_PHASE,
  PROJECT_VERSION,
  STATE_SCHEMA_VERSION,
} from "../utils/constants.js";
import {
  RULES_READY,
  RULES_SPECIFICATION_COMPLETE,
} from "./engine/Rules.js";
import { SCORING_READY } from "./engine/Scoring.js";
import { TURN_MANAGER_READY } from "./engine/TurnManager.js";
import { BOARD_PLAY_READY } from "./engine/PlayTransition.js";
import { MATCH_SETUP_READY } from "./setup/createMatch.js";

export { createEmptyGameState } from "./model/GameState.js";
export { createEmptyBoard } from "./model/Board.js";
export {
  createDomino,
  createDominoId,
  generateDoubleSixSet,
  isDouble,
} from "./model/Domino.js";
export { DomainError } from "./errors/DomainError.js";
export { createMatch, MATCH_SETUP_READY } from "./setup/createMatch.js";
export { dealRoundRobin } from "./setup/Deal.js";
export { validateInitialMatchSnapshot } from "./setup/InitialStateValidator.js";
export {
  getEffectiveK,
  validateSpecialDoubleLimit,
} from "./setup/MatchConfig.js";
export { getCounterclockwiseSuccessor } from "./setup/Seating.js";
export { shuffle } from "./setup/Shuffle.js";
export { findStartingPlayerId } from "./setup/StartingPlayer.js";
export {
  getDerivedBranches,
  getOpenEndTargets,
} from "./engine/BoardQueries.js";
export { validateBoardState } from "./engine/BoardValidator.js";
export {
  areValuesCompatible,
  getMatchingSideIds,
  isDominoCompatibleWithValue,
} from "./engine/Compatibility.js";
export { getLegalPlays } from "./engine/LegalPlays.js";
export { applyPlay, BOARD_PLAY_READY } from "./engine/PlayTransition.js";

export function getEngineStatus() {
  return {
    loaded: true,
    version: PROJECT_VERSION,
    stateSchemaVersion: STATE_SCHEMA_VERSION,
    phase: PROJECT_PHASE,
    specificationComplete: RULES_SPECIFICATION_COMPLETE,
    matchSetupReady: MATCH_SETUP_READY,
    boardPlayReady: BOARD_PLAY_READY,
    gameplayReady: RULES_READY && SCORING_READY && TURN_MANAGER_READY,
  };
}
