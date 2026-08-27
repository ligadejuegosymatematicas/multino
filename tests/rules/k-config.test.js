import assert from "node:assert/strict";
import test from "node:test";

import {
  getEffectiveK,
  validateSpecialDoubleLimit,
} from "../../src/js/game/setup/MatchConfig.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";

for (const K of [0, 1, 7, 8, 10_000]) {
  test(`R-027/DEC-011: acepta K=${K} y conserva su valor`, () => {
    assert.equal(validateSpecialDoubleLimit(K), K);
    assert.equal(getEffectiveK(K), Math.min(K, 7));
  });
}

test("R-027: rechaza K negativo", () => {
  assertThrowsDomainCode(
    () => validateSpecialDoubleLimit(-1),
    "INVALID_K_RANGE",
  );
});

for (const K of [1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
  test(`R-027: rechaza K no entero finito (${String(K)})`, () => {
    assertThrowsDomainCode(
      () => validateSpecialDoubleLimit(K),
      "INVALID_K_TYPE",
    );
  });
}

