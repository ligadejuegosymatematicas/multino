import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  createMatch,
  getLegalPlays,
  getLegalTargetsForDomino,
  projectGraphView,
} from "../../src/js/game/index.js";
import {
  createGraphScene,
} from "../../src/js/ui/GraphScene.js";
import { renderGraphSvgMarkup } from "../../src/js/ui/GraphRenderer.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

function createDeterministicMatch() {
  return createMatch({
    ...createValidParticipantInput(),
    K: 7,
    randomSource: () => 0.999999,
  });
}

function playFirst(state, dominoId) {
  const action = getLegalPlays(state, state.currentPlayerId).find(
    (play) => play.dominoId === dominoId,
  );
  return applyTurnAction(state, action);
}

test("el SVG inicial renderiza exactamente los siete vértices estables", () => {
  const state = createDeterministicMatch();
  const view = projectGraphView(state);
  const scene = createGraphScene(view);
  const markup = renderGraphSvgMarkup(scene);

  assert.equal(scene.vertices.length, 7);
  assert.deepEqual(
    scene.vertices.map((vertex) => vertex.value),
    [0, 1, 2, 3, 4, 5, 6],
  );
  assert.equal(markup.match(/class="graph-vertex /g)?.length, 7);
  assert.equal(scene.edges.length, 0);
  assert.equal(scene.loops.length, 0);
  assert.equal(scene.openTargets.length, 0);
});

test("una ficha ordinaria produce una arista SVG identificable", () => {
  const state = playFirst(createDeterministicMatch(), "0-3");
  const scene = createGraphScene(projectGraphView(state));
  const markup = renderGraphSvgMarkup(scene);

  assert.equal(scene.edges.length, 1);
  assert.equal(scene.loops.length, 0);
  assert.equal(scene.edges[0].dominoId, "0-3");
  assert.equal(scene.edges[0].placementId, "placement-1");
  assert.match(
    markup,
    /class="graph-edge" data-placement-id="placement-1" role="button" tabindex="0"/,
  );
});

test("un chancho usa un lazo sólido distinto de sus cuatro curvas", () => {
  const state = playFirst(createDeterministicMatch(), "6-6");
  const scene = createGraphScene(projectGraphView(state));
  const markup = renderGraphSvgMarkup(scene);

  assert.equal(scene.edges.length, 0);
  assert.equal(scene.loops.length, 1);
  assert.equal(scene.loops[0].dominoId, "6-6");
  assert.equal(scene.openTargets.length, 4);
  assert.equal(new Set(scene.openTargets.map((target) => target.id)).size, 4);
  assert.equal(markup.match(/class="open-target /g)?.length, 4);
  assert.match(markup, /class="graph-loop"[^>]+role="button" tabindex="0"/);
  assert.match(markup, /class="open-target__curve"/);
});

test("q targets del mismo valor conservan q indicadores seleccionables", () => {
  const state = playFirst(createDeterministicMatch(), "6-6");
  const legalTargets = getLegalTargetsForDomino(
    state,
    state.currentPlayerId,
    "4-6",
  );
  const view = projectGraphView(state);
  const before = structuredClone(view);
  const scene = createGraphScene(view, {
    selectedDominoId: "4-6",
    legalTargets,
  });
  const valueSix = scene.vertices.find((vertex) => vertex.value === 6);

  assert.equal(legalTargets.length, 4);
  assert.equal(scene.openTargets.filter((target) => target.isLegal).length, 4);
  assert.equal(valueSix.legalTargetIds.length, 4);
  assert.equal(scene.multiplicities.find((item) => item.value === 6).count, 4);
  assert.deepEqual(view, before);
});

test("START existe como acción separada y nunca como curva ficticia", () => {
  const state = createDeterministicMatch();
  const dominoId = state.hands[state.currentPlayerId][0];
  const legalTargets = getLegalTargetsForDomino(
    state,
    state.currentPlayerId,
    dominoId,
  );
  const scene = createGraphScene(projectGraphView(state), {
    selectedDominoId: dominoId,
    legalTargets,
  });

  assert.deepEqual(legalTargets, [{ kind: "START" }]);
  assert.equal(scene.canStart, true);
  assert.equal(scene.openTargets.length, 0);
});
