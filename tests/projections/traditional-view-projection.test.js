import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyTurnAction,
  getLegalPlays,
  getTraditionalBoardProjection,
  projectGraphView,
  projectTraditionalView,
} from "../../src/js/game/index.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";
import { createExitTurnState } from "../fixtures/turn-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

function createMainAndBranchesScenario() {
  let state = createBoardScenario({ K: 2, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(
    state,
    "0-4",
    targetAt("placement-1", "main:1"),
  );
  state = playDomino(
    state,
    "3-4",
    targetAt("placement-1", "main:2"),
  );
  state = playDomino(
    state,
    "2-3",
    targetAt("placement-3", "side:a"),
  );
  state = playDomino(
    state,
    "2-4",
    targetAt("placement-1", "branch:1"),
  );
  state = playDomino(
    state,
    "2-2",
    targetAt("placement-5", "side:a"),
  );
  return playDomino(
    state,
    "1-4",
    targetAt("placement-1", "branch:2"),
  );
}

test("reconstruye mainLine en orden y orienta sus puertos consecutivos", () => {
  const projection = getTraditionalBoardProjection(
    createMainAndBranchesScenario(),
  );

  assert.deepEqual(projection.mainLine.placementIds, [
    "placement-2",
    "placement-1",
    "placement-3",
    "placement-4",
  ]);
  assert.deepEqual(projection.mainLine.connectionIds, [
    "connection-1",
    "connection-2",
    "connection-3",
  ]);
  assert.deepEqual(
    projection.mainLine.tiles.map((tile) => ({
      placementId: tile.placementId,
      dominoId: tile.dominoId,
      startValue: tile.start.value,
      endValue: tile.end.value,
      startConnectionId: tile.start.connectionId,
      endConnectionId: tile.end.connectionId,
    })),
    [
      {
        placementId: "placement-2",
        dominoId: "0-4",
        startValue: 0,
        endValue: 4,
        startConnectionId: null,
        endConnectionId: "connection-1",
      },
      {
        placementId: "placement-1",
        dominoId: "4-4",
        startValue: 4,
        endValue: 4,
        startConnectionId: "connection-1",
        endConnectionId: "connection-2",
      },
      {
        placementId: "placement-3",
        dominoId: "3-4",
        startValue: 4,
        endValue: 3,
        startConnectionId: "connection-2",
        endConnectionId: "connection-3",
      },
      {
        placementId: "placement-4",
        dominoId: "2-3",
        startValue: 3,
        endValue: 2,
        startConnectionId: "connection-3",
        endConnectionId: null,
      },
    ],
  );
});

test("reconstruye ambos brazos desde la raíz hasta su terminal exacto", () => {
  const projection = getTraditionalBoardProjection(
    createMainAndBranchesScenario(),
  );
  const family = projection.branchFamilies[0];

  assert.deepEqual(
    {
      code: family.code,
      rootPlacementId: family.rootPlacementId,
      rootMainOrder: family.rootMainOrder,
    },
    { code: "A", rootPlacementId: "placement-1", rootMainOrder: 2 },
  );
  assert.deepEqual(
    family.arms.map((arm) => ({
      armIndex: arm.armIndex,
      originPortId: arm.originPortId,
      originValue: arm.origin.value,
      originConnectionId: arm.origin.connectionId,
      placementIds: arm.placementIds,
      connectionIds: arm.connectionIds,
      terminalId: arm.openTarget.id,
    })),
    [
      {
        armIndex: 1,
        originPortId: "branch:1",
        originValue: 4,
        originConnectionId: "connection-4",
        placementIds: ["placement-5", "placement-6"],
        connectionIds: ["connection-4", "connection-5"],
        terminalId: "placement-6:side:b",
      },
      {
        armIndex: 2,
        originPortId: "branch:2",
        originValue: 4,
        originConnectionId: "connection-6",
        placementIds: ["placement-7"],
        connectionIds: ["connection-6"],
        terminalId: "placement-7:side:a",
      },
    ],
  );
  assert.equal(family.arms[0].tiles[1].doubleRole, "ORDINARY_DOUBLE");
  assert.equal(family.arms[0].tiles[1].isSpecialDouble, false);
});

test("un chancho posterior sigue ordinario y no crea familia", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(
    state,
    "3-4",
    targetAt("placement-1", "main:2"),
  );
  state = playDomino(
    state,
    "3-3",
    targetAt("placement-2", "side:a"),
  );
  const projection = getTraditionalBoardProjection(state);
  const ordinary = projection.mainLine.tiles.at(-1);

  assert.equal(ordinary.isDouble, true);
  assert.equal(ordinary.isSpecialDouble, false);
  assert.equal(ordinary.doubleRole, "ORDINARY_DOUBLE");
  assert.equal(projection.branchFamilies.length, 1);
  assert.equal(
    projection.branchFamilies.some(
      (family) => family.rootPlacementId === ordinary.placementId,
    ),
    false,
  );
});

test("los extremos tradicionales conservan identidad y contrato canónico", () => {
  const projection = getTraditionalBoardProjection(
    createMainAndBranchesScenario(),
  );

  assert.deepEqual(
    projection.openTargets.map((target) => ({
      id: target.id,
      placementId: target.placementId,
      portId: target.portId,
      region: target.topology.region,
      armIndex: target.topology.armIndex,
    })),
    [
      {
        id: "placement-2:side:a",
        placementId: "placement-2",
        portId: "side:a",
        region: "main",
        armIndex: null,
      },
      {
        id: "placement-4:side:a",
        placementId: "placement-4",
        portId: "side:a",
        region: "main",
        armIndex: null,
      },
      {
        id: "placement-6:side:b",
        placementId: "placement-6",
        portId: "side:b",
        region: "branch",
        armIndex: 1,
      },
      {
        id: "placement-7:side:a",
        placementId: "placement-7",
        portId: "side:a",
        region: "branch",
        armIndex: 2,
      },
    ],
  );
});

test("Grafo y Tradicional exponen exactamente las mismas jugadas legales", () => {
  const state = createMainAndBranchesScenario();
  const playerId = state.currentPlayerId;
  const graph = projectGraphView(state, playerId);
  const traditional = projectTraditionalView(state, playerId);

  assert.deepEqual(traditional.legalPlays, graph.legalPlays);
  assert.deepEqual(traditional.hand, graph.hand);
  assert.deepEqual(traditional.scoring, graph.scoring);
  assert.deepEqual(traditional.turn, graph.turn);
  assert.deepEqual(traditional.roundStatus, graph.roundStatus);
});

test("la proyección terminal conserva la mesa y elimina acciones", () => {
  const state = createExitTurnState();
  const terminal = applyTurnAction(
    state,
    getLegalPlays(state, state.currentPlayerId)[0],
  );
  const projection = projectTraditionalView(terminal);

  assert.equal(projection.roundStatus.phase, "finished");
  assert.ok(projection.roundStatus.roundResult);
  assert.deepEqual(projection.legalPlays, []);
  assert.equal(
    projection.table.mainLine.tiles.length +
      projection.table.branchFamilies.flatMap((family) => family.arms)
        .flatMap((arm) => arm.tiles).length,
    Object.keys(terminal.board.placements).length,
  );
});

test("la proyección es inmutable y no contiene geometría ni DOM", async () => {
  const state = createMainAndBranchesScenario();
  const before = structuredClone(state);
  const projection = getTraditionalBoardProjection(state);
  projection.mainLine.placementIds.push("falso");
  projection.branchFamilies[0].arms[0].placementIds.push("falso");
  projection.openTargets[0].portId = "falso";

  assert.deepEqual(state, before);
  const source = await readFile(
    new URL(
      "../../src/js/game/projections/TraditionalViewProjection.js",
      import.meta.url,
    ),
    "utf8",
  );
  assert.doesNotMatch(source, /\bdocument\b|\bwindow\b|\bCanvas\b|\bSVG\b/);
  assert.doesNotMatch(source, /\bx\s*:|\by\s*:|coordinate|angle/);
});
