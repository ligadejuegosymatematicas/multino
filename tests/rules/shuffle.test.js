import assert from "node:assert/strict";
import test from "node:test";

import { shuffle } from "../../src/js/game/setup/Shuffle.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";

function sequenceRandom(values) {
  let index = 0;
  return () => values[index++];
}

test("R-029: Fisher–Yates produce una permutación determinista con fuente inyectada", () => {
  const input = ["a", "b", "c", "d"];
  const result = shuffle(input, sequenceRandom([0, 0, 0]));

  assert.deepEqual(result, ["b", "c", "d", "a"]);
  assert.deepEqual(input, ["a", "b", "c", "d"]);
});

test("R-029: no pierde ni duplica elementos", () => {
  const input = Array.from({ length: 28 }, (_, index) => `D${index}`);
  const result = shuffle(input, () => 0.5);

  assert.equal(result.length, input.length);
  assert.deepEqual([...result].sort(), [...input].sort());
  assert.equal(new Set(result).size, input.length);
});

test("R-029: la misma fuente controlada reproduce la misma mezcla", () => {
  const input = ["a", "b", "c", "d", "e"];
  const values = [0.1, 0.8, 0.3, 0.6];

  assert.deepEqual(
    shuffle(input, sequenceRandom(values)),
    shuffle(input, sequenceRandom(values)),
  );
});

test("R-029: rechaza valores fuera del contrato [0, 1)", () => {
  assertThrowsDomainCode(
    () => shuffle(["a", "b"], () => 1),
    "INVALID_RANDOM_VALUE",
  );
});

