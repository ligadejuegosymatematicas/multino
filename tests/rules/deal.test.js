import assert from "node:assert/strict";
import test from "node:test";

import { generateDoubleSixSet } from "../../src/js/game/model/Domino.js";
import { dealRoundRobin } from "../../src/js/game/setup/Deal.js";
import { shuffle } from "../../src/js/game/setup/Shuffle.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

function allDealtIds(hands) {
  return Object.values(hands).flat();
}

test("R-006/R-029: reparte cuatro manos de siete sin stock", () => {
  const dominoIds = generateDoubleSixSet().map((domino) => domino.id);
  const { seating } = createValidParticipantInput();
  const hands = dealRoundRobin(dominoIds, seating);

  assert.deepEqual(
    Object.values(hands).map((hand) => hand.length),
    [7, 7, 7, 7],
  );
  assert.equal("stock" in hands, false);
});

test("R-006: la unión contiene las 28 fichas y las intersecciones son vacías", () => {
  const dominoIds = generateDoubleSixSet().map((domino) => domino.id);
  const { seating } = createValidParticipantInput();
  const hands = dealRoundRobin(dominoIds, seating);
  const dealtIds = allDealtIds(hands);

  assert.equal(dealtIds.length, 28);
  assert.equal(new Set(dealtIds).size, 28);
  assert.deepEqual([...dealtIds].sort(), [...dominoIds].sort());
});

test("R-029: la convención circular usa índice i → asiento i mod 4", () => {
  const dominoIds = generateDoubleSixSet().map((domino) => domino.id);
  const { seating } = createValidParticipantInput();
  const hands = dealRoundRobin(dominoIds, seating);

  assert.deepEqual(hands.P1, dominoIds.filter((_, index) => index % 4 === 0));
  assert.deepEqual(hands.P2, dominoIds.filter((_, index) => index % 4 === 1));
  assert.deepEqual(hands.P3, dominoIds.filter((_, index) => index % 4 === 2));
  assert.deepEqual(hands.P4, dominoIds.filter((_, index) => index % 4 === 3));
});

test("R-029: mezcla controlada y reparto son reproducibles", () => {
  const dominoIds = generateDoubleSixSet().map((domino) => domino.id);
  const { seating } = createValidParticipantInput();

  const first = dealRoundRobin(shuffle(dominoIds, () => 0.25), seating);
  const second = dealRoundRobin(shuffle(dominoIds, () => 0.25), seating);

  assert.deepEqual(first, second);
});

