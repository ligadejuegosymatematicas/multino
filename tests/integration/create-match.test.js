import assert from "node:assert/strict";
import test from "node:test";

import {
  createMatch,
  getRoundStructureMode,
  ROUND_STRUCTURE_MODES,
  validateInitialMatchSnapshot,
} from "../../src/js/game/index.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

function createValidMatch(overrides = {}) {
  return createMatch({
    ...createValidParticipantInput(),
    mode: ROUND_STRUCTURE_MODES.BRANCHED,
    randomSource: () => 0.25,
    ...overrides,
  });
}

test("createMatch produce un snapshot v6 ramificado preparado", () => {
  const snapshot = createValidMatch({ matchId: "match-test" });

  assert.equal(snapshot.schemaVersion, 6);
  assert.equal(snapshot.matchId, "match-test");
  assert.equal(snapshot.phase, "playing");
  assert.equal(snapshot.turnNumber, 1);
  assert.equal(snapshot.consecutivePasses, 0);
  assert.equal(Object.keys(snapshot.players).length, 4);
  assert.equal(Object.keys(snapshot.teams).length, 2);
  assert.equal(Object.keys(snapshot.dominoes).length, 28);
  assert.deepEqual(
    Object.values(snapshot.hands).map((hand) => hand.length),
    [7, 7, 7, 7],
  );
  assert.equal(snapshot.hands[snapshot.currentPlayerId].includes("6-6"), true);
  assert.deepEqual(snapshot.board, {
    placements: {},
    connections: {},
    mainLine: { placementIds: [] },
    specialDoublePlacementIds: [],
  });
  assert.deepEqual(snapshot.score.teams, { A: 0, B: 0 });
  assert.equal(snapshot.config.specialMainLineDoublesLimit, 1);
  assert.equal(getRoundStructureMode(snapshot.config), "RAMIFICADO");
  assert.deepEqual(snapshot.history, []);
  assert.equal("stock" in snapshot, false);
});

test("createMatch codifica Lineal como cero sin exponer K", () => {
  const snapshot = createValidMatch({ mode: ROUND_STRUCTURE_MODES.LINEAR });

  assert.equal(snapshot.config.specialMainLineDoublesLimit, 0);
  assert.equal(getRoundStructureMode(snapshot.config), "LINEAL");
});

test("R-029: createMatch es reproducible con una fuente controlada", () => {
  const first = createValidMatch();
  const second = createValidMatch();

  assert.deepEqual(first.hands, second.hands);
  assert.equal(first.currentPlayerId, second.currentPlayerId);
});

test("createMatch no muta la configuración de participantes recibida", () => {
  const input = createValidParticipantInput();
  const before = structuredClone(input);

  createMatch({
    ...input,
    mode: ROUND_STRUCTURE_MODES.LINEAR,
    randomSource: () => 0.5,
  });

  assert.deepEqual(input, before);
});

test("el snapshot inicial es serializable y supera su validador público", () => {
  const snapshot = createValidMatch();
  const restored = JSON.parse(JSON.stringify(snapshot));

  assert.equal(validateInitialMatchSnapshot(snapshot), snapshot);
  assert.deepEqual(restored, snapshot);
  assert.doesNotThrow(() => validateInitialMatchSnapshot(restored));
});
