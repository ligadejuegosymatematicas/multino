import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyGameState } from "../src/js/game/model/GameState.js";

test("el estado inicial puede hacer round-trip por JSON", () => {
  const state = createEmptyGameState({ specialMainLineDoublesLimit: 3 });
  const restored = JSON.parse(JSON.stringify(state));

  assert.deepEqual(restored, state);
  assert.equal(restored.config.specialMainLineDoublesLimit, 3);
});

test("la codificación estructural interna queda sin configurar en el estado vacío", () => {
  const state = createEmptyGameState();

  assert.equal(state.config.specialMainLineDoublesLimit, null);
  assert.equal(state.currentPlayerId, null);
  assert.deepEqual(state.history, []);
});

test("cada estado inicial mantiene colecciones independientes", () => {
  const first = createEmptyGameState();
  const second = createEmptyGameState();

  first.history.push({ sequence: 1 });
  first.seating.counterclockwisePlayerIds.push("example");
  first.score.teams.A = 3;

  assert.deepEqual(second.history, []);
  assert.deepEqual(second.seating.counterclockwisePlayerIds, []);
  assert.deepEqual(second.score.teams, {});
});

test("el estado v6 es autosuficiente y no modela pozo ni ramas persistidas", () => {
  const state = createEmptyGameState();

  assert.equal(state.schemaVersion, 6);
  assert.equal(state.consecutivePasses, 0);
  assert.deepEqual(state.score, { teams: {} });
  assert.equal("stock" in state, false);
  assert.equal("branches" in state.board, false);
  assert.deepEqual(state.board.specialDoublePlacementIds, []);
});
