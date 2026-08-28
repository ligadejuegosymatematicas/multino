import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateMoveScore,
  calculateOpenEndsSum,
  getOpenEndTargets,
  getScoringTerms,
} from "../../src/js/game/index.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

function doubleTerm(state, placementId = "placement-1") {
  return getScoringTerms(state).find(
    (term) => term.placementId === placementId,
  );
}

test("R-014: un tablero vacío no contiene términos y S es cero", () => {
  const state = createBoardScenario({ K: 0 });

  assert.deepEqual(getScoringTerms(state), []);
  assert.equal(calculateOpenEndsSum(state), 0);
});

test("R-014: una ficha ordinaria aporta una vez por cada lado abierto", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "4-6" });
  state = playDomino(state, "4-6");

  assert.deepEqual(getScoringTerms(state), [
    {
      placementId: "placement-1",
      dominoId: "4-6",
      portId: "side:a",
      value: 4,
      contribution: 4,
      reason: "OPEN_ORDINARY_SIDE",
    },
    {
      placementId: "placement-1",
      dominoId: "4-6",
      portId: "side:b",
      value: 6,
      contribution: 6,
      reason: "OPEN_ORDINARY_SIDE",
    },
  ]);

  state = playDomino(state, "3-4", (target) => target.value === 4);
  assert.deepEqual(
    getScoringTerms(state).filter(
      (term) => term.placementId === "placement-1",
    ),
    [
      {
        placementId: "placement-1",
        dominoId: "4-6",
        portId: "side:b",
        value: 6,
        contribution: 6,
        reason: "OPEN_ORDINARY_SIDE",
      },
    ],
  );

  state = playDomino(state, "0-6", (target) => target.value === 6);
  assert.deepEqual(
    getScoringTerms(state).filter(
      (term) => term.placementId === "placement-1",
    ),
    [],
  );
});

test("R-018/R-019/R-033: un chancho aporta 2N con 0/1 conexión y cero con 2/3/4", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "5-5" });
  state = playDomino(state, "5-5");
  assert.deepEqual(doubleTerm(state), {
    placementId: "placement-1",
    dominoId: "5-5",
    connectionCount: 0,
    contribution: 10,
    reason: "DOUBLE_WITH_AT_MOST_ONE_CONNECTION",
  });

  state = playDomino(state, "1-5", targetAt("placement-1", "main:1"));
  assert.equal(doubleTerm(state).connectionCount, 1);
  assert.equal(doubleTerm(state).contribution, 10);

  state = playDomino(state, "2-5", targetAt("placement-1", "main:2"));
  assert.equal(doubleTerm(state).connectionCount, 2);
  assert.equal(doubleTerm(state).contribution, 0);

  state = playDomino(state, "3-5", targetAt("placement-1", "branch:1"));
  assert.equal(doubleTerm(state).connectionCount, 3);
  assert.equal(doubleTerm(state).contribution, 0);
  assert.equal(
    getOpenEndTargets(state).some(
      (target) =>
        target.placementId === "placement-1" &&
        target.portId === "branch:2",
    ),
    true,
  );

  state = playDomino(state, "4-5", targetAt("placement-1", "branch:2"));
  assert.equal(doubleTerm(state).connectionCount, 4);
  assert.equal(doubleTerm(state).contribution, 0);
});

test("R-018: un chancho ordinario usa la misma regla de aporte", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  assert.equal(doubleTerm(state).connectionCount, 0);
  assert.equal(doubleTerm(state).contribution, 8);

  state = playDomino(state, "1-4", (target) => target.value === 4);
  assert.equal(doubleTerm(state).connectionCount, 1);
  assert.equal(doubleTerm(state).contribution, 8);

  state = playDomino(
    state,
    "2-4",
    (target) =>
      target.value === 4 && target.placementId === "placement-1",
  );
  assert.equal(doubleTerm(state).connectionCount, 2);
  assert.equal(doubleTerm(state).contribution, 0);
});

test("varias fuentes abiertas del mismo valor se cuentan por separado", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-3" });
  state = playDomino(state, "2-3");
  state = playDomino(state, "2-5", (target) => target.value === 2);
  state = playDomino(state, "3-5", (target) => target.value === 3);

  const fiveTerms = getScoringTerms(state).filter(
    (term) => term.contribution === 5,
  );
  assert.equal(fiveTerms.length, 2);
  assert.notEqual(fiveTerms[0].placementId, fiveTerms[1].placementId);
  assert.equal(calculateOpenEndsSum(state), 10);
});

test("destinos jugables y términos de S son contratos distintos", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "5-5" });
  state = playDomino(state, "5-5");

  assert.equal(getOpenEndTargets(state).length, 4);
  assert.equal(getScoringTerms(state).length, 1);
  assert.equal(calculateOpenEndsSum(state), 10);
});

test("R-015/R-016: la política fija de múltiplos de 5 calcula puntos", () => {
  assert.deepEqual(
    [0, 5, 10, 15, 7, 11, 23].map((sum) => calculateMoveScore(sum)),
    [0, 1, 2, 3, 0, 0, 0],
  );
  assertThrowsDomainCode(() => calculateMoveScore(-5), "INVALID_OPEN_ENDS_SUM");
  assertThrowsDomainCode(() => calculateMoveScore(2.5), "INVALID_OPEN_ENDS_SUM");
});
