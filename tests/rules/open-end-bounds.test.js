import assert from "node:assert/strict";
import test from "node:test";

import { getOpenEndTargets } from "../../src/js/game/engine/BoardQueries.js";
import { ROUND_STRUCTURE_MODES } from "../../src/js/game/setup/MatchConfig.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

test("Ramificado admite cuatro destinos alrededor de su único chancho", () => {
  let state = createBoardScenario({
    mode: ROUND_STRUCTURE_MODES.BRANCHED,
    firstDominoId: "4-4",
  });
  state = playDomino(state, "4-4");
  assert.equal(getOpenEndTargets(state).length, 4);

  state = playDomino(state, "3-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "3-3", targetAt("placement-2", "side:a"));
  assert.deepEqual(state.board.specialDoublePlacementIds, ["placement-1"]);
  assert.equal(getOpenEndTargets(state).length, 4);
});

test("Lineal conserva exactamente dos extremos en un tablero no vacío", () => {
  let state = createBoardScenario({
    mode: ROUND_STRUCTURE_MODES.LINEAR,
    firstDominoId: "4-4",
  });
  state = playDomino(state, "4-4");
  assert.equal(getOpenEndTargets(state).length, 2);
  state = playDomino(state, "3-4", targetAt("placement-1", "side:b"));
  assert.equal(getOpenEndTargets(state).length, 2);
});

test("cuatro destinos del mismo valor son acciones individuales", () => {
  let state = createBoardScenario({ firstDominoId: "6-6" });
  state = playDomino(state, "6-6");
  const targets = getOpenEndTargets(state);

  assert.equal(targets.length, 4);
  assert.equal(targets.every((target) => target.value === 6), true);
  assert.equal(new Set(targets.map((target) => target.id)).size, 4);
});
