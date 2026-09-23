import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  chooseCpuAction,
  createCpuSeatView,
  createDefaultSeats,
  createMatch,
  participantsFromSeats,
  ROUND_STRUCTURE_MODES,
} from "../../src/js/game/index.js";
import {
  drainServerCpuTurns,
  reconstructAuthoritativeFrames,
} from "../../supabase/functions/_shared/authoritative-action.js";

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function createRound(seed = 1, humanCount = 1) {
  return createMatch({
    ...participantsFromSeats(createDefaultSeats({ humanCount })),
    matchId: `presentation-${seed}`,
    mode: ROUND_STRUCTURE_MODES.BRANCHED,
    randomSource: seededRandom(seed),
  });
}

test("reconstruye todos los fotogramas confirmados después de una secuencia", () => {
  let state = createRound(73, 4);
  for (let index = 0; index < 10 && state.phase === "playing"; index += 1) {
    state = applyTurnAction(state, chooseCpuAction(createCpuSeatView(state)));
  }
  const replay = reconstructAuthoritativeFrames(state, 3);
  assert.equal(replay.baseState.history.length, 3);
  assert.deepEqual(
    replay.states.map((frame) => frame.history.at(-1).sequence),
    state.history.slice(3).map((entry) => entry.sequence),
  );
  assert.deepEqual(replay.states.at(-1), state);
});

test("la reconstrucción conserva el estado terminal y su scoring final", () => {
  let state = createRound(91, 4);
  while (state.phase === "playing") {
    state = applyTurnAction(state, chooseCpuAction(createCpuSeatView(state)));
  }
  const afterSequence = Math.max(0, state.history.length - 2);
  const replay = reconstructAuthoritativeFrames(state, afterSequence);
  assert.equal(replay.states.length, state.history.length - afterSequence);
  assert.deepEqual(replay.states.at(-1), state);
  assert.equal(replay.states.at(-1).phase, "finished");
  assert.deepEqual(replay.states.at(-1).score, state.score);
  assert.deepEqual(replay.states.at(-1).roundResult, state.roundResult);
});

test("1H+3CPU produce estados intermedios sin temporizar la autoridad", () => {
  const state = createRound(114, 1);
  const cpuSeatIds = new Set(["seat-2", "seat-3", "seat-4"]);
  const firstHumanAction = chooseCpuAction(createCpuSeatView(state));
  const afterHuman = applyTurnAction(state, firstHumanAction);
  const drained = drainServerCpuTurns(afterHuman, cpuSeatIds);
  assert.deepEqual(
    drained.states.map((frame) => frame.history.at(-1)),
    drained.moves,
  );
  assert.equal(drained.states.length, drained.moves.length);
  assert.ok(drained.moves.length >= 1);
  assert.equal(
    drained.state.currentPlayerId === "seat-1" || drained.state.phase === "finished",
    true,
  );
});
