import {
  applyTurnAction,
  chooseCpuAction,
  createEmptyBoard,
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
  const states = [];
  while (next.phase === "playing" && cpuSeatIds.has(next.currentPlayerId)) {
    const action = chooseCpuAction(createCpuSeatView(next, next.currentPlayerId));
    next = applyTurnAction(next, action);
    moves.push(structuredClone(next.history.at(-1)));
    states.push(structuredClone(next));
  }
  return { state: next, moves, states };
}

function actionFromHistory(entry) {
  if (entry.type === "PASS") {
    return { type: "PASS", playerId: entry.playerId };
  }
  return {
    type: "PLAY_DOMINO",
    playerId: entry.playerId,
    dominoId: entry.payload.dominoId,
    target: structuredClone(entry.payload.target),
  };
}

function createReplayOrigin(state) {
  const hands = structuredClone(state.hands);
  for (const entry of state.history) {
    if (entry.type !== "PLAY_DOMINO") continue;
    hands[entry.playerId].push(entry.payload.dominoId);
  }
  const origin = structuredClone(state);
  origin.phase = "playing";
  origin.turnNumber = 1;
  origin.currentPlayerId = state.history[0]?.playerId ?? state.currentPlayerId;
  origin.consecutivePasses = 0;
  origin.hands = hands;
  origin.board = createEmptyBoard();
  origin.score = {
    teams: Object.fromEntries(Object.keys(state.score.teams).map((teamId) => [teamId, 0])),
  };
  origin.history = [];
  delete origin.roundResult;
  return origin;
}

/**
 * Reconstruye únicamente en servidor los estados públicos intermedios. La
 * autoridad continúa avanzando de inmediato; los clientes reciben fotogramas
 * confirmados para presentarlos sin saltarse jugadas CPU.
 */
export function reconstructAuthoritativeFrames(state, afterSequence = 0) {
  const requestedSequence = Number.isSafeInteger(afterSequence)
    ? Math.max(0, afterSequence)
    : 0;
  let replay = createReplayOrigin(state);
  let baseState = structuredClone(replay);
  const states = [];
  for (const entry of state.history) {
    replay = applyTurnAction(replay, actionFromHistory(entry));
    if (entry.sequence <= requestedSequence) {
      baseState = structuredClone(replay);
    } else {
      states.push(structuredClone(replay));
    }
  }
  return { baseState, states };
}
