import assert from "node:assert/strict";
import test from "node:test";

import { getOpenEndTargets } from "../../src/js/game/engine/BoardQueries.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

test("R-032/R-034: hay exactamente 2 + 2s destinos abiertos en un tablero válido no vacío", () => {
  let state = createBoardScenario({ K: 2, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  assert.equal(getOpenEndTargets(state).length, 4);

  state = playDomino(state, "3-4", targetAt("placement-1", "main:2"));
  assert.equal(getOpenEndTargets(state).length, 4);

  state = playDomino(state, "3-3", targetAt("placement-2", "side:a"));
  assert.equal(state.board.specialDoublePlacementIds.length, 2);
  assert.equal(getOpenEndTargets(state).length, 6);

  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  assert.equal(getOpenEndTargets(state).length, 6);
});

test("doble-seis/K=7: el máximo global de destinos es 16 y el máximo por valor 8 es alcanzable", () => {
  let state = createBoardScenario({ K: 7, firstDominoId: "6-6" });
  state = playDomino(state, "6-6");

  const mainContinuation = [
    "0-6",
    "0-0",
    "0-1",
    "1-1",
    "1-2",
    "2-2",
    "2-3",
    "3-3",
    "3-4",
    "4-4",
    "4-5",
    "5-5",
    "5-6",
  ];
  for (const dominoId of mainContinuation) {
    const [first, second] = dominoId.split("-").map(Number);
    const openValue = getOpenEndTargets(state).find(
      (target) => target.kind === "main" && target.mainLineEnd === "end",
    ).value;
    assert.ok(first === openValue || second === openValue, dominoId);
    state = playDomino(
      state,
      dominoId,
      (target) => target.kind === "main" && target.mainLineEnd === "end",
    );
  }

  const specialByDominoId = Object.fromEntries(
    state.board.specialDoublePlacementIds.map((placementId) => [
      state.board.placements[placementId].dominoId,
      placementId,
    ]),
  );
  for (const value of [1, 2, 3, 4]) {
    state = playDomino(
      state,
      `${value}-6`,
      targetAt(specialByDominoId[`${value}-${value}`], "branch:1"),
    );
  }

  const targets = getOpenEndTargets(state);
  assert.equal(state.board.specialDoublePlacementIds.length, 7);
  assert.equal(targets.length, 16);
  assert.equal(targets.filter((target) => target.value === 6).length, 8);
  assert.equal(new Set(targets.map((target) => target.id)).size, 16);
});
