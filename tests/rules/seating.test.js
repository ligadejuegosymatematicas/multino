import assert from "node:assert/strict";
import test from "node:test";

import { getCounterclockwiseSuccessor } from "../../src/js/game/setup/Seating.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

test("R-009: recorre el ciclo antihorario completo", () => {
  const { seating } = createValidParticipantInput();

  assert.equal(getCounterclockwiseSuccessor(seating, "P1"), "P2");
  assert.equal(getCounterclockwiseSuccessor(seating, "P2"), "P3");
  assert.equal(getCounterclockwiseSuccessor(seating, "P3"), "P4");
});

test("R-009: después del cuarto jugador vuelve el primero", () => {
  const { seating } = createValidParticipantInput();

  assert.equal(getCounterclockwiseSuccessor(seating, "P4"), "P1");
});

test("R-009: rechaza un jugador inexistente", () => {
  const { seating } = createValidParticipantInput();

  assertThrowsDomainCode(
    () => getCounterclockwiseSuccessor(seating, "PX"),
    "UNKNOWN_SEATED_PLAYER",
  );
});

