import { RULESET_VERSION } from "../../config/AppConfig.js";

export function createMatchRecord({
  initialState,
  finalState,
  seats,
  startedAt,
  finishedAt,
} = {}) {
  if (finalState?.phase !== "finished") {
    throw new Error("Solo una ronda terminada puede archivarse.");
  }
  return {
    matchId: finalState.matchId,
    rulesetVersion: RULESET_VERSION,
    startedAt,
    finishedAt,
    seats: structuredClone(seats),
    teams: structuredClone(finalState.teams),
    moves: structuredClone(finalState.history),
    scores: structuredClone(finalState.score.teams),
    winner: finalState.roundResult.winnerTeamId,
    terminationReason: finalState.roundResult.reason,
    initialSnapshot: structuredClone(initialState),
  };
}

