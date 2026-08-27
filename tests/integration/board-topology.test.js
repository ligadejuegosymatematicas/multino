import assert from "node:assert/strict";
import test from "node:test";

import { applyPlay } from "../../src/js/game/engine/PlayTransition.js";
import {
  getDerivedBranches,
  getOpenEndTargets,
} from "../../src/js/game/engine/BoardQueries.js";
import { getLegalPlays } from "../../src/js/game/engine/LegalPlays.js";
import {
  createBoardScenario,
  findDominoOwner,
  playDomino,
} from "../fixtures/board-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

test("Caso C/R-001/R-027/R-032: el primer chancho principal dentro de K es especial", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");

  assert.deepEqual(state.board.specialDoublePlacementIds, ["placement-1"]);
  assert.deepEqual(
    getOpenEndTargets(state).map(({ value, portId, kind }) => ({
      value,
      portId,
      kind,
    })),
    [
      { value: 4, portId: "main:1", kind: "main" },
      { value: 4, portId: "main:2", kind: "main" },
      { value: 4, portId: "branch:1", kind: "branch-origin" },
      { value: 4, portId: "branch:2", kind: "branch-origin" },
    ],
  );
});

test("Caso D/R-034: un branch:* especial inicia una cadena lateral derivable", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));

  assert.deepEqual(state.board.mainLine.placementIds, ["placement-1"]);
  assert.equal(Object.hasOwn(state.board, "branches"), false);
  assert.deepEqual(getDerivedBranches(state), [
    {
      id: "placement-1:branch:1",
      origin: { placementId: "placement-1", portId: "branch:1" },
      placementIds: ["placement-2"],
      connectionIds: ["connection-1"],
      terminal: { placementId: "placement-2", portId: "side:a" },
    },
  ]);
  assert.ok(
    getOpenEndTargets(state).some(
      (target) =>
        target.kind === "branch" &&
        target.placementId === "placement-2" &&
        target.portId === "side:a" &&
        target.value === 2,
    ),
  );
});

test("Caso E/R-002/R-035: un chancho dentro de rama es ordinario y no bifurca", () => {
  let state = createBoardScenario({ K: 2, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "2-2", targetAt("placement-2", "side:a"));

  assert.deepEqual(state.board.specialDoublePlacementIds, ["placement-1"]);
  assert.deepEqual(getDerivedBranches(state)[0].placementIds, [
    "placement-2",
    "placement-3",
  ]);
  const branchTargets = getOpenEndTargets(state).filter(
    (target) => target.placementId === "placement-3",
  );
  assert.deepEqual(branchTargets, [
    {
      id: "placement-3:side:b",
      value: 2,
      placementId: "placement-3",
      portId: "side:b",
      kind: "branch",
      branchOrigin: {
        placementId: "placement-1",
        portId: "branch:1",
      },
    },
  ]);
});

test("Caso F/R-027: K=0 deja todos los chanchos con dos puertos ordinarios", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");

  assert.deepEqual(state.board.specialDoublePlacementIds, []);
  assert.deepEqual(
    getOpenEndTargets(state).map((target) => target.portId),
    ["side:a", "side:b"],
  );
});

test("Caso G/R-001: agotado K, otro chancho principal queda ordinario", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "3-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "3-3", targetAt("placement-2", "side:a"));

  assert.deepEqual(state.board.specialDoublePlacementIds, ["placement-1"]);
  assert.ok(
    getOpenEndTargets(state).some(
      (target) =>
        target.placementId === "placement-3" &&
        target.portId === "side:b" &&
        target.kind === "main",
    ),
  );
});

test("Caso H/R-019/R-032/R-033: un chancho especial admite cuatro conexiones y no una quinta", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "0-4", targetAt("placement-1", "main:1"));
  state = playDomino(state, "1-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "3-4", targetAt("placement-1", "branch:2"));

  assert.equal(
    Object.values(state.board.connections).filter(
      (connection) =>
        connection.from.placementId === "placement-1" ||
        connection.to.placementId === "placement-1",
    ).length,
    4,
  );
  assert.equal(
    getOpenEndTargets(state).some(
      (target) => target.placementId === "placement-1",
    ),
    false,
  );

  const playerId = findDominoOwner(state, "4-5");
  assert.throws(
    () =>
      applyPlay(state, {
        type: "PLAY_DOMINO",
        playerId,
        dominoId: "4-5",
        target: {
          kind: "OPEN_END",
          placementId: "placement-1",
          portId: "branch:1",
        },
      }),
    (error) => error.code === "INVALID_OPEN_END_TARGET",
  );
});

test("DEC-028: una ficha genera una jugada por cada destino individual del mismo valor", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const playerId = findDominoOwner(state, "4-5");

  const matchingPlays = getLegalPlays(state, playerId).filter(
    (play) => play.dominoId === "4-5",
  );
  assert.equal(matchingPlays.length, 4);
  assert.equal(
    new Set(
      matchingPlays.map(
        (play) => `${play.target.placementId}:${play.target.portId}`,
      ),
    ).size,
    4,
  );
});
