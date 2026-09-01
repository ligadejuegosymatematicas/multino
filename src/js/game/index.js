import {
  PROJECT_PHASE,
  PROJECT_VERSION,
  STATE_SCHEMA_VERSION,
} from "../utils/constants.js";
import {
  RULES_READY,
  RULES_SPECIFICATION_COMPLETE,
} from "./engine/Rules.js";
import {
  PLAY_SCORING_READY,
  SCORING_READY,
} from "./engine/Scoring.js";
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
export {
  calculateFinalBonus,
  calculateMoveScore,
  calculateOpenEndsSum,
  getScoringTerms,
  PLAY_SCORING_READY,
  SCORING_READY,
} from "./engine/Scoring.js";
export {
  calculateRemainingPipsByTeam,
  ROUND_END_REASONS,
} from "./engine/RoundCompletion.js";
export { applyPlay, BOARD_PLAY_READY } from "./engine/PlayTransition.js";
export { validateRoundState } from "./engine/RoundValidator.js";
export {
  applyTurnAction,
  getAvailableActions,
  TURN_MANAGER_READY,
} from "./engine/TurnManager.js";
export { getValueGraphProjection } from "./projections/ValueGraphProjection.js";
export {
  getOpenEndVisualProjection,
  groupOpenEndsByValue,
} from "./projections/OpenEndProjection.js";
export {
  getLegalPlayProjection,
  getLegalTargetsForDomino,
} from "./projections/LegalPlayProjection.js";
export { getScoringProjection } from "./projections/ScoringProjection.js";
export { getLatestActionProjection } from "./projections/ActionProjection.js";
export { getBoardTopologyProjection } from "./projections/TopologyProjection.js";
export { projectRoundView } from "./projections/RoundViewProjection.js";
export { projectGraphView } from "./projections/GraphViewProjection.js";
export {
  getTraditionalBoardProjection,
  projectTraditionalView,
} from "./projections/TraditionalViewProjection.js";

export function getEngineStatus() {
  return {
    loaded: true,
    version: PROJECT_VERSION,
    stateSchemaVersion: STATE_SCHEMA_VERSION,
    phase: PROJECT_PHASE,
    specificationComplete: RULES_SPECIFICATION_COMPLETE,
    matchSetupReady: MATCH_SETUP_READY,
    boardPlayReady: BOARD_PLAY_READY,
    turnFlowReady: TURN_MANAGER_READY,
    playScoringReady: PLAY_SCORING_READY,
    gameplayReady: RULES_READY && SCORING_READY && TURN_MANAGER_READY,
  };
}
