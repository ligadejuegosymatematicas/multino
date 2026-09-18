import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  createMatch,
  getLegalPlays,
  getScoringPresentation,
  getStrategicDecisionGroups,
  getStrategicTargetProjections,
  STRATEGIC_DECISION_KINDS,
} from "../../src/js/game/index.js";
import { createBoardScenario } from "../fixtures/board-scenarios.js";
import { createValidParticipantInput } from "../fixtures/participants.js";
import { createExitTurnState } from "../fixtures/turn-scenarios.js";

function createDeterministicMatch() {
  return createMatch({
    ...createValidParticipantInput(),
    randomSource: () => 0.999999,
  });
}

function playFirst(state, dominoId) {
  const action = getLegalPlays(state, state.currentPlayerId).find(
    (candidate) => candidate.dominoId === dominoId,
  );
  return applyTurnAction(state, action);
}

function playMatching(state, dominoId, targetMatcher = () => true) {
  const action = getLegalPlays(state, state.currentPlayerId).find(
    (candidate) =>
      candidate.dominoId === dominoId && targetMatcher(candidate.target),
  );
  assert.ok(action, `Debe existir una jugada legal para ${dominoId}.`);
  return applyTurnAction(state, action);
}

function createOrdinaryAndArmDecisionState() {
  let state = createDeterministicMatch();
  state = playMatching(state, "6-6");
  state = playMatching(state, "4-6", (target) => target.portId === "main:1");
  state = playMatching(
    state,
    "2-6",
    (target) => target.placementId === "placement-1",
  );
  state = playMatching(
    state,
    "0-2",
    (target) => target.placementId === "placement-3",
  );
  state = playMatching(
    state,
    "0-3",
    (target) => target.placementId === "placement-4",
  );
  state = playMatching(
    state,
    "3-5",
    (target) => target.placementId === "placement-5",
  );
  state = playMatching(
    state,
    "0-5",
    (target) => target.placementId === "placement-6",
  );
  state = playMatching(
    state,
    "0-6",
    (target) => target.placementId === "placement-7",
  );
  return playMatching(
    state,
    "2-4",
    (target) => target.placementId === "placement-2",
  );
}

test("proyecta S y puntos exactos por target sin modificar el snapshot", () => {
  const state = playFirst(createDeterministicMatch(), "6-6");
  const before = structuredClone(state);
  const projections = getStrategicTargetProjections(
    state,
    state.currentPlayerId,
    "4-6",
  );

  assert.equal(projections.length, 2);
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

  assert.equal(new Set(identities).size, 2);
  assert.equal(
    projections.filter(({ continuation }) => continuation.region === "main")
      .length,
    2,
  );
  assert.equal(
    projections.filter(({ opensBranchArm }) => opensBranchArm).length,
    0,
  );
});

test("agrupa dos lugares físicamente distintos cuando su consecuencia estratégica coincide", () => {
  const state = playFirst(createDeterministicMatch(), "6-6");
  const before = structuredClone(state);
  const groups = getStrategicDecisionGroups(
    state,
    state.currentPlayerId,
    "4-6",
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].value, 6);
  assert.equal(groups[0].decisionKind, STRATEGIC_DECISION_KINDS.CONTINUE);
  assert.equal(groups[0].physicalTargetCount, 2);
  assert.equal(groups[0].isEquivalentGroup, true);
  assert.deepEqual(groups[0].canonicalTarget, {
    kind: "OPEN_END",
    placementId: "placement-1",
    portId: "main:1",
  });
  assert.deepEqual(
    groups[0].targets.map(({ placementId, portId }) => ({
      placementId,
      portId,
    })),
    [
      { placementId: "placement-1", portId: "main:1" },
      { placementId: "placement-1", portId: "main:2" },
    ],
  );
  assert.deepEqual(state, before);
});

test("separa continuar un extremo de abrir dos brazos equivalentes", () => {
  const state = createOrdinaryAndArmDecisionState();
  const before = structuredClone(state);
  const groups = getStrategicDecisionGroups(
    state,
    state.currentPlayerId,
    "1-6",
  );

  assert.equal(groups.length, 2);
  const continuation = groups.find(
    ({ decisionKind }) => decisionKind === STRATEGIC_DECISION_KINDS.CONTINUE,
  );
  const openArm = groups.find(
    ({ decisionKind }) => decisionKind === STRATEGIC_DECISION_KINDS.OPEN_ARM,
  );
  assert.equal(continuation.physicalTargetCount, 1);
  assert.equal(openArm.physicalTargetCount, 2);
  assert.equal(openArm.isEquivalentGroup, true);
  assert.equal(
    continuation.outcome.branchingDouble.connectionCount,
    2,
  );
  assert.equal(openArm.outcome.branchingDouble.connectionCount, 3);
  assert.notDeepEqual(continuation.outcome.scoring, openArm.outcome.scoring);
  assert.deepEqual(state, before);
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
