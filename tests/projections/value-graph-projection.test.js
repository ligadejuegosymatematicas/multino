import assert from "node:assert/strict";
import test from "node:test";

import {
  getOpenEndTargets,
  getValueGraphProjection,
} from "../../src/js/game/index.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

test("el grafo vacío conserva siempre los siete vértices", () => {
  const state = createBoardScenario({ K: 0 });

  assert.deepEqual(getValueGraphProjection(state), {
    vertices: [0, 1, 2, 3, 4, 5, 6].map((value) => ({
      value,
      incidentPlacementIds: [],
    })),
    edges: [],
  });
});

test("una ficha ordinaria produce una arista temporalmente enlazada", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-5" });
  state = playDomino(state, "2-5");
  const historyEntry = state.history[0];
  const playerId = historyEntry.playerId;
  const projection = getValueGraphProjection(state);

  assert.deepEqual(projection.edges, [
    {
      dominoId: "2-5",
      placementId: "placement-1",
      a: 2,
      b: 5,
      isLoop: false,
      playSequence: historyEntry.sequence,
      turnNumber: historyEntry.turn,
      playerId,
      teamId: state.players[playerId].teamId,
    },
  ]);
  assert.deepEqual(projection.vertices[2].incidentPlacementIds, [
    "placement-1",
  ]);
  assert.deepEqual(projection.vertices[5].incidentPlacementIds, [
    "placement-1",
  ]);
});

test("un chancho produce un lazo incidente una sola vez", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "5-5" });
  state = playDomino(state, "5-5");
  const projection = getValueGraphProjection(state);

  assert.equal(projection.edges[0].isLoop, true);
  assert.equal(projection.edges[0].a, 5);
  assert.equal(projection.edges[0].b, 5);
  assert.deepEqual(projection.vertices[5].incidentPlacementIds, [
    "placement-1",
  ]);
});

test("varias aristas incidentes comparten vértice sin volverse paralelas", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-5" });
  state = playDomino(state, "2-5");
  state = playDomino(state, "3-5", (target) => target.value === 5);
  state = playDomino(state, "2-4", (target) => target.value === 2);
  const projection = getValueGraphProjection(state);
  const pairKeys = projection.edges.map(({ a, b }) =>
    [a, b].sort((first, second) => first - second).join("-"),
  );

  assert.deepEqual(projection.vertices[5].incidentPlacementIds, [
    "placement-1",
    "placement-2",
  ]);
  assert.equal(new Set(pairKeys).size, pairKeys.length);
});

test("el grafo de valores no reconstruye línea principal ni ramas", () => {
  let mainState = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  mainState = playDomino(mainState, "4-4");
  mainState = playDomino(
    mainState,
    "2-4",
    targetAt("placement-1", "main:1"),
  );
  mainState = playDomino(
    mainState,
    "3-4",
    targetAt("placement-1", "main:2"),
  );
  mainState = playDomino(
    mainState,
    "1-4",
    targetAt("placement-1", "branch:1"),
  );
  mainState = playDomino(
    mainState,
    "1-2",
    targetAt("placement-2", "side:a"),
  );

  let branchState = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  branchState = playDomino(branchState, "4-4");
  branchState = playDomino(
    branchState,
    "2-4",
    targetAt("placement-1", "main:1"),
  );
  branchState = playDomino(
    branchState,
    "3-4",
    targetAt("placement-1", "main:2"),
  );
  branchState = playDomino(
    branchState,
    "1-4",
    targetAt("placement-1", "branch:1"),
  );
  branchState = playDomino(
    branchState,
    "1-2",
    targetAt("placement-4", "side:a"),
  );

  assert.deepEqual(
    getValueGraphProjection(mainState),
    getValueGraphProjection(branchState),
  );
  assert.notDeepEqual(
    mainState.board.mainLine.placementIds,
    branchState.board.mainLine.placementIds,
  );
  assert.notDeepEqual(
    getOpenEndTargets(mainState),
    getOpenEndTargets(branchState),
  );
});
