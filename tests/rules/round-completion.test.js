import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFinalBonus,
  calculateRemainingPipsByTeam,
} from "../../src/js/game/index.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";
import { createBlockedOutcomeState } from "../fixtures/turn-scenarios.js";

for (const [remainingPips, expectedBonus] of [
  [0, 0],
  [1, 0],
  [2, 0],
  [5, 1],
  [6, 1],
  [7, 1],
  [3, 1],
  [4, 1],
  [8, 2],
  [9, 2],
]) {
  test(`R-023: a=${remainingPips} produce bonificación ${expectedBonus}`, () => {
    assert.equal(calculateFinalBonus(remainingPips), expectedBonus);
  });
}

test("R-023 rechaza un total restante inválido", () => {
  assertThrowsDomainCode(
    () => calculateFinalBonus(-1),
    "INVALID_REMAINING_PIPS",
  );
  assertThrowsDomainCode(
    () => calculateFinalBonus(2.5),
    "INVALID_REMAINING_PIPS",
  );
});

test("R-021: cada ficha aporta la suma de sus dos lados al equipo", () => {
  const state = createBlockedOutcomeState("A");

  assert.deepEqual(calculateRemainingPipsByTeam(state), {
    A: 6,
    B: 120,
  });
  assert.deepEqual(state.hands.P1, ["1-1"]);
  assert.deepEqual(state.hands.P3, ["2-2"]);
});
