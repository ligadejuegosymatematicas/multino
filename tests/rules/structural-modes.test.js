import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  createMatch,
  getAvailableActions,
  getOpenEndTargets,
  getBoardTopologyProjection,
  getRoundStructureProjection,
  ROUND_STRUCTURE_MODES,
} from "../../src/js/game/index.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

test("Ramificado convierte el primer doble posterior a una apertura ordinaria", () => {
  let state = createBoardScenario({
    mode: ROUND_STRUCTURE_MODES.BRANCHED,
    firstDominoId: "2-5",
  });
  state = playDomino(state, "2-5");
  assert.deepEqual(state.board.specialDoublePlacementIds, []);

  state = playDomino(state, "5-5", targetAt("placement-1", "side:b"));
  assert.deepEqual(state.board.specialDoublePlacementIds, ["placement-2"]);
  assert.equal(
    getOpenEndTargets(state).filter((target) =>
      target.placementId === "placement-2"
    ).length,
    3,
  );
});

test("segundo y tercer doble son ordinarios y no abren nuevos brazos", () => {
  let state = createBoardScenario({ firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "3-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "3-3", targetAt("placement-2", "side:a"));
  state = playDomino(state, "2-3", targetAt("placement-3", "side:b"));
  state = playDomino(state, "2-2", targetAt("placement-4", "side:a"));

  assert.deepEqual(state.board.specialDoublePlacementIds, ["placement-1"]);
  const topology = getBoardTopologyProjection(state);
  for (const placementId of ["placement-3", "placement-5"]) {
    const placement = topology.placements.find(
      (candidate) => candidate.placementId === placementId,
    );
    assert.equal(placement.isSpecialDouble, false);
    assert.equal(placement.doubleRole, "ORDINARY_DOUBLE");
    assert.equal(placement.connectionCapacity, 2);
    assert.equal(placement.branchFamily, null);
  }
});

test("Lineal completa una ronda sin crear brazos ni chanchos ramificadores", () => {
  let state = createMatch({
    ...createValidParticipantInput(),
    mode: ROUND_STRUCTURE_MODES.LINEAR,
    randomSource: () => 0.999999,
  });
  for (let actions = 0; state.phase === "playing" && actions < 100; actions += 1) {
    state = applyTurnAction(state, getAvailableActions(state)[0]);
  }

  assert.equal(state.phase, "finished");
  assert.deepEqual(state.board.specialDoublePlacementIds, []);
  assert.equal(
    Object.values(state.board.connections).some((connection) =>
      [connection.from.portId, connection.to.portId].some((portId) =>
        portId.startsWith("branch:")
      )
    ),
    false,
  );
});

test("la proyección deriva n/7, targets reales y estado del ramificador", () => {
  let state = createBoardScenario({ firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  let projection = getRoundStructureProjection(state);
  const value4 = projection.values.find((entry) => entry.value === 4);

  assert.deepEqual(value4, {
    value: 4,
    playedTileCount: 1,
    totalTileCount: 7,
    openTargetCount: 4,
  });
  assert.deepEqual(projection.branchingDouble, {
    value: 4,
    placementId: "placement-1",
    connectionCount: 0,
    capacity: 4,
    remainingConnections: 4,
    isSaturated: false,
  });

  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  projection = getRoundStructureProjection(state);
  assert.equal(
    projection.values.find((entry) => entry.value === 4).playedTileCount,
    2,
  );
  assert.equal(projection.branchingDouble.connectionCount, 1);
  assert.equal(projection.branchingDouble.remainingConnections, 3);
});

test("dos targets iguales cuentan dos y cuatro conexiones saturan el ramificador", () => {
  let state = createBoardScenario({ firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "0-4", targetAt("placement-1", "main:1"));
  state = playDomino(state, "1-4", targetAt("placement-1", "main:2"));
  let projection = getRoundStructureProjection(state);
  assert.equal(
    projection.values.find((entry) => entry.value === 4).openTargetCount,
    2,
  );

  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "3-4", targetAt("placement-1", "branch:2"));
  projection = getRoundStructureProjection(state);
  assert.deepEqual(projection.branchingDouble, {
    value: 4,
    placementId: "placement-1",
    connectionCount: 4,
    capacity: 4,
    remainingConnections: 0,
    isSaturated: true,
  });
});

test("Lineal proyecta branchingDouble nulo", () => {
  let state = createBoardScenario({
    mode: ROUND_STRUCTURE_MODES.LINEAR,
    firstDominoId: "6-6",
  });
  state = playDomino(state, "6-6");
  const projection = getRoundStructureProjection(state);
  assert.equal(projection.mode, ROUND_STRUCTURE_MODES.LINEAR);
  assert.equal(projection.branchingDouble, null);
  assert.equal(projection.values.find((entry) => entry.value === 6).openTargetCount, 2);
});
