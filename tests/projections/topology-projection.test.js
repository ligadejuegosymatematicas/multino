import assert from "node:assert/strict";
import test from "node:test";

import { getBoardTopologyProjection } from "../../src/js/game/index.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

function placementAt(projection, placementId) {
  return projection.placements.find(
    (placement) => placement.placementId === placementId,
  );
}

test("clasifica línea principal y rama con orden, raíz y profundidad", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(
    state,
    "3-4",
    targetAt("placement-1", "main:2"),
  );
  state = playDomino(
    state,
    "2-4",
    targetAt("placement-1", "branch:1"),
  );
  state = playDomino(
    state,
    "2-5",
    targetAt("placement-3", "side:a"),
  );
  const projection = getBoardTopologyProjection(state);

  assert.deepEqual(projection.mainLine, {
    id: "main",
    code: "P",
    label: "Principal",
    placementIds: ["placement-1", "placement-2"],
  });
  assert.equal(placementAt(projection, "placement-1").region, "main");
  assert.equal(placementAt(projection, "placement-1").order, 1);
  assert.equal(placementAt(projection, "placement-2").order, 2);
  assert.deepEqual(projection.branches, [
    {
      id: "placement-1:branch:1",
      familyId: "branch-family:placement-1",
      familyCode: "A",
      familyLabel: "Ramificación A",
      familyIndex: 0,
      armIndex: 1,
      originPlacementId: "placement-1",
      originPortId: "branch:1",
      placementIds: ["placement-3", "placement-4"],
    },
  ]);
  assert.deepEqual(
    {
      region: placementAt(projection, "placement-3").region,
      structureCode:
        placementAt(projection, "placement-3").structureCode,
      structureLabel:
        placementAt(projection, "placement-3").structureLabel,
      order: placementAt(projection, "placement-3").order,
      originPlacementId:
        placementAt(projection, "placement-3").originPlacementId,
      originPortId: placementAt(projection, "placement-3").originPortId,
      depth: placementAt(projection, "placement-3").depth,
    },
    {
      region: "branch",
      structureCode: "A",
      structureLabel: "Ramificación A",
      order: 1,
      originPlacementId: "placement-1",
      originPortId: "branch:1",
      depth: 1,
    },
  );
  assert.equal(placementAt(projection, "placement-4").depth, 2);
});

test("clasifica el chancho especial y resume capacidad K efectiva", () => {
  let state = createBoardScenario({ K: 8, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const projection = getBoardTopologyProjection(state);
  const root = placementAt(projection, "placement-1");

  assert.equal(root.isDouble, true);
  assert.equal(root.isSpecialDouble, true);
  assert.equal(root.doubleRole, "SPECIAL_MAIN");
  assert.equal(root.connectionCapacity, 4);
  assert.equal(root.startedBranchCount, 0);
  assert.deepEqual(projection.specialDoubles, {
    configuredK: 8,
    effectiveK: 7,
    enabledCount: 1,
    remainingCapacity: 6,
  });
});

test("clasifica un chancho principal ordinario cuando K está agotado", () => {
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
  const projection = getBoardTopologyProjection(state);
  const ordinaryMain = placementAt(projection, "placement-3");

  assert.equal(ordinaryMain.region, "main");
  assert.equal(ordinaryMain.isDouble, true);
  assert.equal(ordinaryMain.isSpecialDouble, false);
  assert.equal(ordinaryMain.isOrdinaryDoubleByKExhaustion, true);
  assert.equal(ordinaryMain.isOrdinaryDoubleInBranch, false);
  assert.equal(ordinaryMain.doubleRole, "ORDINARY_MAIN_K_EXHAUSTED");
  assert.equal(ordinaryMain.connectionCapacity, 2);
  assert.equal(ordinaryMain.branchFamily, null);
  assert.equal(projection.branchFamilies.length, 1);
});

test("clasifica un chancho ordinario dentro de una rama sin consumir K", () => {
  let state = createBoardScenario({ K: 2, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(
    state,
    "2-4",
    targetAt("placement-1", "branch:1"),
  );
  state = playDomino(
    state,
    "2-2",
    targetAt("placement-2", "side:a"),
  );
  const projection = getBoardTopologyProjection(state);
  const branchDouble = placementAt(projection, "placement-3");

  assert.equal(branchDouble.region, "branch");
  assert.equal(branchDouble.depth, 2);
  assert.equal(branchDouble.isDouble, true);
  assert.equal(branchDouble.isSpecialDouble, false);
  assert.equal(branchDouble.isOrdinaryDoubleByKExhaustion, false);
  assert.equal(branchDouble.isOrdinaryDoubleInBranch, true);
  assert.equal(branchDouble.doubleRole, "ORDINARY_BRANCH");
  assert.equal(branchDouble.branchFamily, null);
  assert.equal(projection.specialDoubles.enabledCount, 1);
  assert.equal(placementAt(projection, "placement-1").startedBranchCount, 1);
});

test("clasifica destinos abiertos por identidad exacta aunque compartan valor", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(
    state,
    "3-4",
    targetAt("placement-1", "main:2"),
  );
  state = playDomino(
    state,
    "2-4",
    targetAt("placement-1", "branch:1"),
  );
  state = playDomino(
    state,
    "2-3",
    targetAt("placement-3", "side:a"),
  );
  const projection = getBoardTopologyProjection(state);
  const targetsById = new Map(
    projection.openTargets.map((target) => [target.targetId, target]),
  );

  assert.equal(targetsById.get("placement-2:side:a").region, "main");
  assert.equal(targetsById.get("placement-2:side:a").structureCode, "P");
  assert.equal(
    targetsById.get("placement-2:side:a").structureLabel,
    "Principal",
  );
  assert.equal(
    targetsById.get("placement-2:side:a").structureId,
    "main",
  );
  assert.equal(targetsById.get("placement-4:side:b").region, "branch");
  assert.equal(targetsById.get("placement-4:side:b").structureCode, "A");
  assert.equal(
    targetsById.get("placement-4:side:b").structureLabel,
    "Ramificación A",
  );
  assert.equal(
    targetsById.get("placement-4:side:b").structureId,
    "placement-1:branch:1",
  );
  assert.equal(
    targetsById.get("placement-4:side:b").familyId,
    "branch-family:placement-1",
  );
  assert.equal(
    targetsById.get("placement-4:side:b").armIndex,
    1,
  );
  assert.equal(
    targetsById.get("placement-4:side:b").branchState,
    "STARTED",
  );
  assert.notEqual(
    targetsById.get("placement-2:side:a").targetId,
    targetsById.get("placement-4:side:b").targetId,
  );
});

test("asigna P a la principal y una familia compartida a los dos brazos de cada especial", () => {
  let state = createBoardScenario({ K: 2, firstDominoId: "4-4" });
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
  const projection = getBoardTopologyProjection(state);

  assert.deepEqual(
    projection.branchFamilies.map((family) => ({
      id: family.id,
      code: family.code,
      label: family.label,
      arms: family.arms.map((arm) => ({
        id: arm.id,
        armIndex: arm.armIndex,
        originPortId: arm.originPortId,
        isOccupied: arm.isOccupied,
      })),
    })),
    [
      {
        id: "branch-family:placement-1",
        code: "A",
        label: "Ramificación A",
        arms: [
          {
            id: "placement-1:branch:1",
            armIndex: 1,
            originPortId: "branch:1",
            isOccupied: false,
          },
          {
            id: "placement-1:branch:2",
            armIndex: 2,
            originPortId: "branch:2",
            isOccupied: false,
          },
        ],
      },
      {
        id: "branch-family:placement-3",
        code: "B",
        label: "Ramificación B",
        arms: [
          {
            id: "placement-3:branch:1",
            armIndex: 1,
            originPortId: "branch:1",
            isOccupied: false,
          },
          {
            id: "placement-3:branch:2",
            armIndex: 2,
            originPortId: "branch:2",
            isOccupied: false,
          },
        ],
      },
    ],
  );
  assert.equal(placementAt(projection, "placement-1").branchFamily.code, "A");
  assert.equal(placementAt(projection, "placement-3").branchFamily.code, "B");
  assert.deepEqual(
    projection.openTargets
      .filter((target) => target.region === "branch")
      .map((target) => target.structureCode),
    ["A", "A", "B", "B"],
  );
  assert.deepEqual(
    projection.openTargets
      .filter((target) => target.region === "branch")
      .map((target) => target.armIndex),
    [1, 2, 1, 2],
  );
  assert.equal(
    new Set(
      projection.openTargets
        .filter((target) => target.region === "branch")
        .map((target) => target.targetId),
    ).size,
    4,
  );
  assert.deepEqual(
    projection.openTargets
      .filter((target) => target.region === "main")
      .map((target) => target.structureCode),
    ["P", "P"],
  );
  assert.equal(
    projection.openTargets
      .filter((target) => target.region === "branch")
      .every((target) => target.branchState === "POTENTIAL"),
    true,
  );
});

test("la proyección topológica no muta ni comparte colecciones con el snapshot", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const before = structuredClone(state);
  const projection = getBoardTopologyProjection(state);

  projection.mainLine.placementIds.push("falso");
  projection.placements[0].region = "branch";
  projection.openTargets[0].region = "branch";
  projection.branchFamilies[0].code = "Z";
  projection.branchFamilies[0].arms[0].placementIds.push("falso");
  projection.specialDoubles.enabledCount = 99;

  assert.deepEqual(state, before);
});
