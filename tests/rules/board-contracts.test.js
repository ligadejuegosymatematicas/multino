import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlacementPorts,
  getPrincipalPortIds,
} from "../../src/js/game/engine/BoardPorts.js";
import {
  getNextHistorySequence,
  getNextSequentialId,
  parseSequentialId,
} from "../../src/js/game/engine/SequentialIds.js";
import { generateDoubleSixSet } from "../../src/js/game/model/Domino.js";
import { createEmptyGameState } from "../../src/js/game/model/GameState.js";

function stateWithPlacement(dominoId, special = false) {
  const state = createEmptyGameState({ specialMainLineDoublesLimit: 1 });
  state.dominoes = Object.fromEntries(
    generateDoubleSixSet().map((domino) => [domino.id, domino]),
  );
  state.board.placements["placement-1"] = {
    id: "placement-1",
    dominoId,
  };
  state.board.mainLine.placementIds.push("placement-1");
  if (special) {
    state.board.specialDoublePlacementIds.push("placement-1");
  }
  return state;
}

test("DEC-026: una ficha ordinaria proyecta side:a y side:b", () => {
  const state = stateWithPlacement("2-5");

  assert.deepEqual(getPlacementPorts(state, "placement-1"), [
    { id: "side:a", value: 2, role: "ordinary", physicalSideId: "a" },
    { id: "side:b", value: 5, role: "ordinary", physicalSideId: "b" },
  ]);
  assert.deepEqual(getPrincipalPortIds(state, "placement-1"), [
    "side:a",
    "side:b",
  ]);
});

test("R-032/DEC-026: un chancho especial proyecta cuatro puertos canónicos", () => {
  const state = stateWithPlacement("4-4", true);
  const ports = getPlacementPorts(state, "placement-1");

  assert.deepEqual(
    ports.map((port) => port.id),
    ["main:1", "main:2", "branch:1", "branch:2"],
  );
  assert.deepEqual(
    ports.map((port) => port.value),
    [4, 4, 4, 4],
  );
  assert.deepEqual(
    ports.map((port) => port.physicalSideId),
    ["a", "b", null, null],
  );
});

test("DEC-027: los IDs siguientes se derivan del máximo cargado", () => {
  assert.equal(
    getNextSequentialId(
      {
        "placement-2": {},
        "placement-7": {},
      },
      "placement",
    ),
    "placement-8",
  );
  assert.equal(parseSequentialId("connection-12", "connection"), 12);
  assert.equal(parseSequentialId("connection-x", "connection"), null);
});

test("DEC-027: sequence se deriva del historial sin contador oculto", () => {
  assert.equal(getNextHistorySequence([]), 1);
  assert.equal(
    getNextHistorySequence([{ sequence: 1 }, { sequence: 4 }]),
    5,
  );
});
