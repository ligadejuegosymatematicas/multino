import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  createMatch,
  getAvailableActions,
  projectTraditionalView,
} from "../../src/js/game/index.js";
import { createTraditionalScene } from "../../src/js/ui/TraditionalScene.js";
import {
  inspectTraditionalLayoutGeometry,
} from "../../src/js/ui/TraditionalSnakeLayout.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

const EXTENDED_STRESS = process.env.DOMINO_TRADITIONAL_STRESS === "1";
const SNAPSHOT_SEEDS_PER_MODE = EXTENDED_STRESS ? 6 : 2;
const COMPLETE_SEEDS_PER_MODE = EXTENDED_STRESS ? 100 : 4;

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function assertCompleteScene(scene, snapshot, context) {
  const placementIds = Object.keys(snapshot.board.placements).sort();
  const sceneIds = scene.tiles.map(({ placementId }) => placementId).sort();
  assert.deepEqual(sceneIds, placementIds, `${context}: faltan placements`);
  assert.equal(
    scene.connections.length,
    Math.max(0, placementIds.length - 1),
    `${context}: faltan conexiones`,
  );
  const audit = inspectTraditionalLayoutGeometry(scene);
  assert.equal(
    audit.isValid,
    true,
    `${context}: ${JSON.stringify(audit)}`,
  );
  const opening = scene.tiles.reduce(
    (first, tile) => first === null || tile.sequence < first.sequence
      ? tile
      : first,
    null,
  );
  if (opening) {
    assert.equal(opening.x, scene.layoutState.softCenter.x, `${context}: x inicial`);
    assert.equal(opening.y, scene.layoutState.softCenter.y, `${context}: y inicial`);
  }
}

function playSeed(mode, seed, onSnapshot = null) {
  const random = createSeededRandom(seed);
  let snapshot = createMatch({
    ...createValidParticipantInput(),
    mode,
    randomSource: random,
  });
  let step = 0;
  while (snapshot.phase === "playing" && step < 80) {
    const actions = getAvailableActions(snapshot);
    const action = actions[Math.floor(random() * actions.length)];
    snapshot = applyTurnAction(snapshot, action);
    step += 1;
    onSnapshot?.(snapshot, step);
  }
  assert.notEqual(snapshot.phase, "playing", `${mode}/seed=${seed}: inconclusa`);
  return snapshot;
}

test("stress reproducible: cada snapshot muestreado conserva geometría tradicional completa", {
  timeout: 90_000,
}, () => {
  for (const mode of ["LINEAL", "RAMIFICADO"]) {
    for (let seed = 1; seed <= SNAPSHOT_SEEDS_PER_MODE; seed += 1) {
      let sessionLayout = null;
      playSeed(mode, seed, (snapshot, step) => {
        const projection = projectTraditionalView(snapshot);
        // Cada quinta jugada simula que Tradicional estaba oculto: el snapshot
        // se valida mediante reconstrucción, pero no actualiza su caché visual.
        const hidden = step % 5 === 0;
        const scene = createTraditionalScene(projection, {
          previousLayout: hidden ? null : sessionLayout,
        });
        assertCompleteScene(scene, snapshot, `${mode}/seed=${seed}/step=${step}`);
        if (!hidden) sessionLayout = scene.layoutState;
      });
    }
  }
});

test("stress de rondas completas: cada seed puede reconstruirse desde cero", {
  timeout: EXTENDED_STRESS ? 360_000 : 45_000,
}, () => {
  for (const mode of ["LINEAL", "RAMIFICADO"]) {
    for (let seed = 1; seed <= COMPLETE_SEEDS_PER_MODE; seed += 1) {
      const snapshot = playSeed(mode, seed);
      const scene = createTraditionalScene(projectTraditionalView(snapshot));
      assertCompleteScene(scene, snapshot, `${mode}/seed=${seed}/final`);
    }
  }
});
