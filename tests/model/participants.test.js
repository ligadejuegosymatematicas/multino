import assert from "node:assert/strict";
import test from "node:test";

import { prepareParticipants } from "../../src/js/game/setup/Participants.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

test("R-003: normaliza cuatro jugadores y dos equipos", () => {
  const result = prepareParticipants(createValidParticipantInput());

  assert.equal(Object.keys(result.players).length, 4);
  assert.equal(Object.keys(result.teams).length, 2);
});

test("R-003: cada equipo contiene exactamente sus dos jugadores", () => {
  const result = prepareParticipants(createValidParticipantInput());

  assert.deepEqual(result.teams.A.playerIds, ["P1", "P3"]);
  assert.deepEqual(result.teams.B.playerIds, ["P2", "P4"]);
  assert.equal(result.players.P1.teamId, "A");
  assert.equal(result.players.P4.teamId, "B");
});

test("R-004: los equipos alternan incluso al cerrar el ciclo", () => {
  const result = prepareParticipants(createValidParticipantInput());
  const seated = result.seating.counterclockwisePlayerIds;
  const teamCycle = seated.map((playerId) => result.players[playerId].teamId);

  assert.deepEqual(teamCycle, ["A", "B", "A", "B"]);
  assert.notEqual(teamCycle.at(-1), teamCycle[0]);
});

