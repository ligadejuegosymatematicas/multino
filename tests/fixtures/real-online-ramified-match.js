import { createBoardScenario, playDomino } from "./board-scenarios.js";

// Regresión anonimizada de la primera Online Alpha: la mesa siguió siendo
// RAMIFICADO, pero Tradicional se reconstruyó después de permanecer oculto.
export const REAL_ONLINE_RAMIFIED_PLAYS = Object.freeze([
  ["6-6", null],
  ["0-6", ["placement-1", "main:1"]],
  ["4-6", ["placement-1", "main:2"]],
  ["0-3", ["placement-2", "side:a"]],
  ["3-6", ["placement-4", "side:b"]],
  ["5-6", ["placement-1", "branch:1"]],
  ["1-6", ["placement-5", "side:b"]],
  ["5-5", ["placement-6", "side:a"]],
  ["2-5", ["placement-8", "side:b"]],
  ["0-2", ["placement-9", "side:a"]],
  ["0-5", ["placement-10", "side:a"]],
  ["1-2", ["placement-7", "side:a"]],
  ["4-5", ["placement-11", "side:b"]],
  ["4-4", ["placement-3", "side:a"]],
  ["2-3", ["placement-12", "side:b"]],
  ["0-4", ["placement-14", "side:b"]],
  ["1-3", ["placement-15", "side:b"]],
  ["1-1", ["placement-17", "side:a"]],
  ["2-4", ["placement-13", "side:a"]],
  ["0-0", ["placement-16", "side:a"]],
  ["0-1", ["placement-20", "side:b"]],
  ["2-2", ["placement-19", "side:a"]],
  ["1-4", ["placement-21", "side:b"]],
]);

export function createRealOnlineRamifiedStates() {
  let state = createBoardScenario({ K: 1, firstDominoId: "6-6" });
  return REAL_ONLINE_RAMIFIED_PLAYS.map(([dominoId, target]) => {
    state = playDomino(
      state,
      dominoId,
      target === null
        ? null
        : (candidate) =>
            candidate.placementId === target[0] &&
            candidate.portId === target[1],
    );
    return state;
  });
}
