import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  createMatch,
  getLegalPlays,
  getScoringPresentation,
  getStrategicTargetProjections,
} from "../../src/js/game/index.js";
import { createBoardScenario } from "../fixtures/board-scenarios.js";
import { createValidParticipantInput } from "../fixtures/participants.js";
import { createExitTurnState } from "../fixtures/turn-scenarios.js";

function createDeterministicMatch() {
  return createMatch({
    ...createValidParticipantInput(),
    K: 7,
    randomSource: () => 0.999999,
  });
}

function playFirst(state, dominoId) {
  const action = getLegalPlays(state, state.currentPlayerId).find(
    (candidate) => candidate.dominoId === dominoId,
  );
  return applyTurnAction(state, action);
}

test("proyecta S y puntos exactos por target sin modificar el snapshot", () => {
  const state = playFirst(createDeterministicMatch(), "6-6");
  const before = structuredClone(state);
  const projections = getStrategicTargetProjections(
    state,
    state.currentPlayerId,
    "4-6",
  );

  assert.equal(projections.length, 4);
  for (const projection of projections) {
    const actual = applyTurnAction(state, projection.action);
    const resolution = getScoringPresentation(actual).latestResolution;
    assert.deepEqual(projection.scoring, resolution);
    assert.equal(
      projection.scoring.scoreAwarded,
      actual.history.at(-1).result.scoreAwarded,
    );
    assert.equal(
      projection.scoring.sum,
      actual.history.at(-1).result.openEndsSum,
    );
  }
  assert.deepEqual(state, before);
});

test("conserva targets repetidos y distingue principal de brazos potenciales", () => {
  const state = playFirst(createDeterministicMatch(), "6-6");
  const projections = getStrategicTargetProjections(
    state,
    state.currentPlayerId,
    "4-6",
  );
  const identities = projections.map(({ action }) =>
    `${action.target.placementId}:${action.target.portId}`
  );

  assert.equal(new Set(identities).size, 4);
  assert.equal(
    projections.filter(({ continuation }) => continuation.region === "main")
      .length,
    2,
  );
  assert.equal(
    projections.filter(({ opensBranchArm }) => opensBranchArm).length,
    2,
  );
  assert.deepEqual(
    projections
      .filter(({ opensBranchArm }) => opensBranchArm)
      .map(({ continuation }) => continuation.armIndex),
    [1, 2],
  );
});

test("la proyección puntuable usa los términos agrupados del motor", () => {
  const state = createBoardScenario({ K: 1, firstDominoId: "5-5" });
  const before = structuredClone(state);
  const [projection] = getStrategicTargetProjections(
    state,
    state.currentPlayerId,
    "5-5",
  );

  assert.deepEqual(projection.target, { kind: "START" });
  assert.equal(projection.scoring.expression, "2×5");
  assert.equal(projection.scoring.sum, 10);
  assert.equal(projection.scoring.isDivisible, true);
  assert.equal(projection.scoring.scoreAwarded, 2);
  assert.deepEqual(
    projection.scoring.terms.map(({ factor, value, contribution }) => ({
      factor,
      value,
      contribution,
    })),
    [{ factor: 2, value: 5, contribution: 10 }],
  );
  assert.deepEqual(state, before);
});

test("rechaza anticipar otro turno y no ofrece outcomes terminales", () => {
  const state = createDeterministicMatch();
  const otherPlayerId = state.seating.counterclockwisePlayerIds.find(
    (playerId) => playerId !== state.currentPlayerId,
  );
  assert.throws(
    () => getStrategicTargetProjections(state, otherPlayerId, "0-0"),
    /jugador actual/,
  );

  const terminalCandidate = createExitTurnState();
  const terminal = applyTurnAction(
    terminalCandidate,
    getLegalPlays(
      terminalCandidate,
      terminalCandidate.currentPlayerId,
    )[0],
  );
  assert.deepEqual(
    getStrategicTargetProjections(
      terminal,
      terminal.currentPlayerId,
      "6-6",
    ),
    [],
  );
});
