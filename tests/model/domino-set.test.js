import assert from "node:assert/strict";
import test from "node:test";

import {
  DOUBLE_SIX_DOMINO_COUNT,
  createDominoId,
  generateDoubleSixSet,
  isDouble,
} from "../../src/js/game/model/Domino.js";

test("R-005: genera exactamente las 28 fichas del doble-seis", () => {
  const dominoes = generateDoubleSixSet();

  assert.equal(dominoes.length, DOUBLE_SIX_DOMINO_COUNT);
});

test("R-005: IDs y combinaciones no contienen duplicados", () => {
  const dominoes = generateDoubleSixSet();
  const ids = dominoes.map((domino) => domino.id);
  const combinations = dominoes.map((domino) =>
    domino.sides.map((side) => side.value).join("-"),
  );

  assert.equal(new Set(ids).size, 28);
  assert.equal(new Set(combinations).size, 28);
});

test("R-005: contiene exactamente siete chanchos derivados", () => {
  const doubles = generateDoubleSixSet().filter(isDouble);

  assert.equal(doubles.length, 7);
  assert.deepEqual(
    doubles.map((domino) => domino.id),
    ["0-0", "1-1", "2-2", "3-3", "4-4", "5-5", "6-6"],
  );
});

test("R-005: todas las combinaciones cumplen 0 ≤ a ≤ b ≤ 6", () => {
  for (const domino of generateDoubleSixSet()) {
    const [firstSide, secondSide] = domino.sides;
    assert.equal(Number.isInteger(firstSide.value), true);
    assert.equal(Number.isInteger(secondSide.value), true);
    assert.equal(firstSide.value >= 0, true);
    assert.equal(firstSide.value <= secondSide.value, true);
    assert.equal(secondSide.value <= 6, true);
  }
});

test("R-005: incluye 0-0 y 6-6 con IDs estables", () => {
  const ids = new Set(generateDoubleSixSet().map((domino) => domino.id));

  assert.equal(ids.has(createDominoId(0, 0)), true);
  assert.equal(ids.has(createDominoId(6, 6)), true);
});

