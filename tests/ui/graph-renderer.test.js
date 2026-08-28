import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
import {
  renderGraphSvgMarkup,
  renderTopologyInspectionMarkup,
} from "../../src/js/ui/GraphRenderer.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

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

function createTopologyScenario() {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(
    state,
    "3-4",
    targetAt("placement-1", "main:2"),
  );
  state = playDomino(
    state,
    "2-4",
    targetAt("placement-1", "branch:1"),
  );
  return playDomino(
    state,
    "2-5",
    targetAt("placement-3", "side:a"),
  );
}

function createDenseScenario() {
  let state = createBoardScenario({ K: 7, firstDominoId: "6-6" });
  state = playDomino(state, "6-6");
  for (const dominoId of [
    "0-6",
    "0-0",
    "0-1",
    "1-1",
    "1-2",
    "2-2",
    "2-3",
    "3-3",
    "3-4",
    "4-4",
    "4-5",
    "5-5",
    "5-6",
  ]) {
    state = playDomino(
      state,
      dominoId,
      (target) => target.kind === "main" && target.mainLineEnd === "end",
    );
  }
  const specialByDominoId = Object.fromEntries(
    state.board.specialDoublePlacementIds.map((placementId) => [
      state.board.placements[placementId].dominoId,
      placementId,
    ]),
  );
  for (const value of [1, 2, 3, 4]) {
    state = playDomino(
      state,
      `${value}-6`,
      targetAt(specialByDominoId[`${value}-${value}`], "branch:1"),
    );
  }
  return state;
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
    /class="graph-edge is-main" data-placement-id="placement-1"[^>]+role="button" tabindex="0"/,
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
  assert.match(markup, /class="graph-loop is-main is-special-double"[^>]+role="button" tabindex="0"/);
  assert.match(markup, /class="graph-special-marker"/);
  assert.match(markup, /Especiales: 1\/7/);
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

test("la inspección resalta una rama completa, conserva su raíz y atenúa el resto", () => {
  const state = createTopologyScenario();
  const scene = createGraphScene(projectGraphView(state), {
    inspectedPlacementId: "placement-4",
  });
  const played = [...scene.edges, ...scene.loops];
  const byPlacementId = new Map(
    played.map((edge) => [edge.placementId, edge]),
  );
  const markup = renderGraphSvgMarkup(scene);
  const inspector = renderTopologyInspectionMarkup(scene.inspection);

  assert.deepEqual(scene.inspection.structurePlacementIds, [
    "placement-3",
    "placement-4",
  ]);
  assert.equal(scene.inspection.rootPlacementId, "placement-1");
  assert.equal(byPlacementId.get("placement-3").isTopologyHighlighted, true);
  assert.equal(byPlacementId.get("placement-4").isTopologyHighlighted, true);
  assert.equal(byPlacementId.get("placement-1").isTopologyRoot, true);
  assert.equal(byPlacementId.get("placement-1").isTopologyDimmed, false);
  assert.equal(byPlacementId.get("placement-2").isTopologyDimmed, true);
  assert.match(markup, /graph-edge is-branch is-inspected is-topology-highlighted/);
  assert.match(markup, /graph-loop is-main is-special-double is-topology-root/);
  assert.match(inspector, /Rama desde 4\|4 · branch:1 · profundidad 2/);
  assert.match(inspector, /data-clear-topology-inspection/);
});

test("la inspección de chanchos explica rol, conexiones y ramas", () => {
  const specialScene = createGraphScene(
    projectGraphView(createTopologyScenario()),
    { inspectedPlacementId: "placement-1" },
  );
  const specialMarkup = renderTopologyInspectionMarkup(
    specialScene.inspection,
  );

  let ordinaryMainState = createBoardScenario({
    K: 1,
    firstDominoId: "4-4",
  });
  ordinaryMainState = playDomino(ordinaryMainState, "4-4");
  ordinaryMainState = playDomino(
    ordinaryMainState,
    "3-4",
    targetAt("placement-1", "main:2"),
  );
  ordinaryMainState = playDomino(
    ordinaryMainState,
    "3-3",
    targetAt("placement-2", "side:a"),
  );
  const ordinaryMainMarkup = renderTopologyInspectionMarkup(
    createGraphScene(projectGraphView(ordinaryMainState), {
      inspectedPlacementId: "placement-3",
    }).inspection,
  );

  let branchDoubleState = createBoardScenario({
    K: 2,
    firstDominoId: "4-4",
  });
  branchDoubleState = playDomino(branchDoubleState, "4-4");
  branchDoubleState = playDomino(
    branchDoubleState,
    "2-4",
    targetAt("placement-1", "branch:1"),
  );
  branchDoubleState = playDomino(
    branchDoubleState,
    "2-2",
    targetAt("placement-2", "side:a"),
  );
  const branchDoubleMarkup = renderTopologyInspectionMarkup(
    createGraphScene(projectGraphView(branchDoubleState), {
      inspectedPlacementId: "placement-3",
    }).inspection,
  );

  assert.match(specialMarkup, /Especial de línea principal/);
  assert.match(specialMarkup, /Conexiones: 2\/4/);
  assert.match(specialMarkup, /Ramas iniciadas: 1\/2/);
  assert.match(ordinaryMainMarkup, /Ordinario de línea principal/);
  assert.match(ordinaryMainMarkup, /Conexiones: 1\/2/);
  assert.match(branchDoubleMarkup, /Ordinario en rama/);
  assert.match(branchDoubleMarkup, /Conexiones: 1\/2/);
});

test("el resumen usa s/effectiveK y no el K configurado imposible", () => {
  let state = createBoardScenario({ K: 20, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const scene = createGraphScene(projectGraphView(state));
  const markup = renderGraphSvgMarkup(scene);

  assert.deepEqual(scene.topologySummary, {
    configuredK: 20,
    effectiveK: 7,
    enabledCount: 1,
    remainingCapacity: 6,
  });
  assert.match(markup, /Especiales: 1\/7/);
  assert.doesNotMatch(markup, /Especiales: 1\/20/);
});

test("un grafo denso conserva fichas, targets e inspección individual", () => {
  const state = createDenseScenario();
  const scene = createGraphScene(projectGraphView(state), {
    inspectedPlacementId: "placement-15",
  });
  const markup = renderGraphSvgMarkup(scene);
  const played = [...scene.edges, ...scene.loops];

  assert.equal(played.length, 18);
  assert.equal(new Set(played.map((edge) => edge.placementId)).size, 18);
  assert.equal(scene.vertices.length, 7);
  assert.equal(scene.openTargets.length, 16);
  assert.equal(new Set(scene.openTargets.map((target) => target.id)).size, 16);
  assert.equal(played.filter((edge) => edge.isTopologyHighlighted).length, 1);
  assert.equal(played.filter((edge) => edge.isTopologyRoot).length, 1);
  assert.equal(played.filter((edge) => edge.isTopologyDimmed).length, 16);
  assert.equal(markup.match(/data-placement-id=/g)?.length, 18);
  assert.equal(markup.match(/class="open-target /g)?.length, 16);
});

test("la diferenciación topológica no depende exclusivamente del color", async () => {
  const boardCss = await readFile(
    new URL("../../src/css/board.css", import.meta.url),
    "utf8",
  );
  const componentsCss = await readFile(
    new URL("../../src/css/components.css", import.meta.url),
    "utf8",
  );

  assert.match(
    boardCss,
    /\.graph-edge\.is-branch[\s\S]+?stroke-dasharray:\s*14 6/,
  );
  assert.match(boardCss, /\.graph-special-marker text/);
  assert.match(componentsCss, /\.legend-branch[\s\S]+?border-top-style:\s*dashed/);
  assert.match(componentsCss, /\.legend-special/);
});

test("GraphRenderer y GraphScene consumen proyecciones sin leer board", async () => {
  for (const moduleUrl of [
    new URL("../../src/js/ui/GraphRenderer.js", import.meta.url),
    new URL("../../src/js/ui/GraphScene.js", import.meta.url),
  ]) {
    const source = await readFile(moduleUrl, "utf8");
    assert.doesNotMatch(source, /\bstate\.board\b|\bview\.board\b/);
  }
});
