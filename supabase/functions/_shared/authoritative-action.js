import {
  applyTurnAction,
  chooseCpuAction,
  createCpuSeatView,
  getAvailableActions,
} from "../../../src/js/game/index.js";

function matchesIntent(action, intent) {
  if (intent.type === "PASS") return action.type === "PASS";
  if (intent.type !== "PLAY_TILE" || action.type !== "PLAY_DOMINO") return false;
  if (action.dominoId !== intent.dominoId || action.target.kind !== intent.target?.kind) {
    return false;
  }
  return action.target.kind === "START" ||
    (action.target.placementId === intent.target.placementId &&
      action.target.portId === intent.target.portId);
}

export function applyAuthenticatedIntent(state, seatId, intent) {
  if (state.currentPlayerId !== seatId) {
    throw Object.assign(new Error("No es el turno del asiento."), { code: "OUT_OF_TURN" });
  }
  const action = getAvailableActions(state).find((candidate) =>
    matchesIntent(candidate, intent)
  );
  if (!action) {
    throw Object.assign(new Error("Acción ilegal."), { code: "ILLEGAL_ACTION" });
  }
  return applyTurnAction(state, action);
}

export function drainServerCpuTurns(state, cpuSeatIds) {
  let next = state;
  const moves = [];
  while (next.phase === "playing" && cpuSeatIds.has(next.currentPlayerId)) {
    const action = chooseCpuAction(createCpuSeatView(next, next.currentPlayerId));
    next = applyTurnAction(next, action);
    moves.push(structuredClone(next.history.at(-1)));
  }
  return { state: next, moves };
}
