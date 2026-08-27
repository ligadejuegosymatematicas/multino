import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyBoard } from "../src/js/game/model/Board.js";

test("el tablero vacío expone el contrato lógico sin geometría", () => {
  const board = createEmptyBoard();

  assert.deepEqual(board, {
    placements: {},
    connections: {},
    mainLine: {
      placementIds: [],
    },
    specialDoublePlacementIds: [],
  });

  assert.equal("x" in board, false);
  assert.equal("y" in board, false);
  assert.doesNotThrow(() => JSON.stringify(board));
});

test("cada tablero vacío obtiene colecciones independientes", () => {
  const first = createEmptyBoard();
  const second = createEmptyBoard();

  first.mainLine.placementIds.push("placement-example");
  first.specialDoublePlacementIds.push("placement-example");

  assert.deepEqual(second.mainLine.placementIds, []);
  assert.deepEqual(second.specialDoublePlacementIds, []);
});
