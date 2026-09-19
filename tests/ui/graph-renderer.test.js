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
  GRAPH_SCENE_LAYOUTS,
} from "../../src/js/ui/GraphScene.js";
import {
  renderGraphSvgMarkup,
  renderTopologyInspectionMarkup,
} from "../../src/js/ui/GraphRenderer.js";
import {
  createBoardScenario,
  findDominoOwner,
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
    "0-4",
    targetAt("placement-1", "main:1"),
  );
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
    "2-3",
    targetAt("placement-4", "side:a"),
  );
}

function createTwoArmFamilyScenario() {
  let state = createBoardScenario({ K: 2, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(
    state,
    "0-4",
    targetAt("placement-1", "main:1"),
  );
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
    "1-4",
    targetAt("placement-1", "branch:2"),
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
  state = playDomino(state, "3-6", targetAt("placement-1", "main:1"));
  state = playDomino(state, "1-6", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "2-6", targetAt("placement-1", "branch:2"));
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
  assert.equal(scene.potentialEdges.length, 21);
  assert.equal(scene.potentialLoops.length, 7);
  assert.equal(markup.match(/class="graph-possibility__edge"/g)?.length, 21);
  assert.equal(markup.match(/class="graph-possibility__loop"/g)?.length, 7);
});

test("el encuadre ancho expande el grafo sin alterar sus siete valores", () => {
  const view = projectGraphView(createDeterministicMatch());
  const compact = createGraphScene(view);
  const wide = createGraphScene(view, {
    layout: GRAPH_SCENE_LAYOUTS.WIDE,
  });
  const compactSpan = Math.max(...compact.vertices.map(({ x }) => x)) -
    Math.min(...compact.vertices.map(({ x }) => x));
  const wideSpan = Math.max(...wide.vertices.map(({ x }) => x)) -
    Math.min(...wide.vertices.map(({ x }) => x));

  assert.equal(wide.layout, "wide");
  assert.equal(wide.viewBox, "0 0 960 620");
  assert.equal(wide.vertices.length, 7);
  assert.ok(wideSpan > compactSpan * 1.2);
  assert.ok(wideSpan < compactSpan * 1.4);
  assert.match(renderGraphSvgMarkup(wide), /<ellipse class="graph-orbit"/);
});

test("K7 posible permanece tenue y el subgrafo jugado conserva otra capa", async () => {
  const state = playFirst(createDeterministicMatch(), "0-3");
  const scene = createGraphScene(projectGraphView(state));
  const markup = renderGraphSvgMarkup(scene);
  const boardCss = await readFile(
    new URL("../../src/css/board.css", import.meta.url),
    "utf8",
  );

  assert.equal(scene.potentialEdges.length, 21);
  assert.equal(scene.potentialLoops.length, 7);
  assert.equal(scene.edges.length, 1);
  assert.ok(
    markup.indexOf('class="graph-possibilities"') <
      markup.indexOf('class="graph-edges"'),
  );
  assert.match(
    boardCss,
    /\.graph-possibility__edge,[\s\S]+?opacity:\s*0\.075/,
  );
  assert.match(
    boardCss,
    /\.graph-root\[data-view-mode="graph"\] \.graph-edge__line[\s\S]+?stroke:\s*#e5dcc7/,
  );
});

test("el feedback destaca solo términos reales de S en el grafo", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "5-5" });
  state = applyTurnAction(
    state,
    getLegalPlays(state, state.currentPlayerId).find(
      (action) => action.dominoId === "5-5",
    ),
  );
  const view = projectGraphView(state);
  const scene = createGraphScene(view, {
    scoringResolution: view.scoringPresentation.latestResolution,
  });
  const markup = renderGraphSvgMarkup(scene);

  assert.equal(scene.loops[0].isScoringTerm, true);
  assert.equal(
    scene.vertices.find((vertex) => vertex.value === 5).isScoringTerm,
    true,
  );
  assert.equal(
    scene.vertices.find((vertex) => vertex.value === 5).scoringMultiplicity,
    2,
  );
  assert.match(markup, /graph-loop is-main is-special-double[^\"]*is-scoring-term/);
  assert.match(markup, /graph-vertex [^"]*is-scoring-term/);
  assert.match(markup, /graph-vertex__scoring-multiplicity[\s\S]+?>×2</);
  assert.match(markup, /data-scoring-anchor-value="5"/);
});

test("Grafo conserva el token cero y excluye un ramificador no contribuyente", () => {
  let zeroState = createBoardScenario({ K: 0, firstDominoId: "0-3" });
  zeroState = playDomino(zeroState, "0-3");
  const zeroView = projectGraphView(zeroState);
  const zeroScene = createGraphScene(zeroView, {
    scoringResolution: {
      terms: zeroView.scoringPresentation.terms,
    },
  });

  assert.equal(
    zeroScene.vertices.find((vertex) => vertex.value === 0).scoringMultiplicity,
    1,
  );
  assert.equal(
    zeroScene.vertices.find((vertex) => vertex.value === 0).isScoringTerm,
    true,
  );
  assert.match(renderGraphSvgMarkup(zeroScene), /data-scoring-anchor-value="0"/);

  let crossedState = createBoardScenario({ K: 1, firstDominoId: "5-5" });
  crossedState = playDomino(crossedState, "5-5");
  crossedState = playDomino(
    crossedState,
    "1-5",
    targetAt("placement-1", "main:1"),
  );
  crossedState = playDomino(
    crossedState,
    "2-5",
    targetAt("placement-1", "main:2"),
  );
  const crossedView = projectGraphView(crossedState);
  const crossedScene = createGraphScene(crossedView, {
    scoringResolution: crossedView.scoringPresentation.latestResolution,
  });

  assert.equal(
    crossedScene.loops.find((loop) => loop.placementId === "placement-1")
      .isScoringTerm,
    false,
  );
});

test("una ficha ordinaria produce una arista identificable sin etiqueta redundante", () => {
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
  assert.doesNotMatch(markup, /graph-edge__label|>0·3<|>0\|3</);
});

test("un chancho inicial usa un lazo sólido y solo dos continuidades", () => {
  const state = playFirst(createDeterministicMatch(), "6-6");
  const scene = createGraphScene(projectGraphView(state));
  const markup = renderGraphSvgMarkup(scene);

  assert.equal(scene.edges.length, 0);
  assert.equal(scene.loops.length, 1);
  assert.equal(scene.loops[0].dominoId, "6-6");
  assert.equal(scene.openTargets.length, 2);
  assert.equal(new Set(scene.openTargets.map((target) => target.id)).size, 2);
  assert.equal(markup.match(/class="open-target /g)?.length, 2);
  assert.match(markup, /class="graph-loop is-main is-special-double[^\"]*"[^>]+role="button" tabindex="0"/);
  assert.doesNotMatch(markup, /graph-special-marker/);
  assert.doesNotMatch(markup, />E<\/text>/);
  assert.doesNotMatch(markup, /graph-loop__label|>6·6<|>6\|6</);
  assert.equal(markup.match(/class="graph-family-root /g)?.length ?? 0, 0);
  assert.doesNotMatch(markup, /data-family-code="A"/);
  assert.deepEqual(
    scene.openTargets.map((target) => target.topology.structureCode),
    ["P", "P"],
  );
  assert.doesNotMatch(markup, /graph-special-summary|Especiales:/);
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

  assert.equal(legalTargets.length, 2);
  assert.equal(scene.openTargets.filter((target) => target.isLegal).length, 2);
  assert.equal(valueSix.legalTargetIds.length, 2);
  const markup = renderGraphSvgMarkup(scene);
  assert.equal(markup.match(/class="open-target__option-index"/g)?.length, 2);
  assert.doesNotMatch(markup, /graph-multiplicity|>×2</);
  assert.deepEqual(view, before);
});

test("targets abiertos del mismo valor distinguen principal y rama", () => {
  const scene = createGraphScene(projectGraphView(createTopologyScenario()));
  const markup = renderGraphSvgMarkup(scene);
  const valueThreeTargets = scene.openTargets.filter(
    (target) => target.value === 3,
  );

  assert.equal(valueThreeTargets.length, 2);
  assert.deepEqual(
    valueThreeTargets.map((target) => ({
      id: target.id,
      region: target.topology.region,
      structureId: target.topology.structureId,
      structureCode: target.topology.structureCode,
    })),
    [
      {
        id: "placement-3:side:a",
        region: "main",
        structureId: "main",
        structureCode: "P",
      },
      {
        id: "placement-5:side:b",
        region: "branch",
        structureId: "placement-1:branch:1",
        structureCode: "A",
      },
    ],
  );
  assert.match(
    markup,
    /open-target is-neutral is-main-target[^>]+data-target-id="placement-3:side:a"/,
  );
  assert.match(
    markup,
    /open-target is-neutral is-branch-target[^>]+data-target-id="placement-5:side:b"/,
  );
  assert.match(markup, /data-structure-code="P"/);
  assert.match(markup, /data-structure-code="A"/);
});

test("la raíz conserva ambos brazos sin exponer letras estructurales", () => {
  const scene = createGraphScene(projectGraphView(createTopologyScenario()));
  const markup = renderGraphSvgMarkup(scene);
  const root = scene.loops.find(
    (loop) => loop.placementId === "placement-1",
  );
  const branchEdges = scene.edges.filter(
    (edge) => edge.topology.structureCode === "A",
  );
  const branchTarget = scene.openTargets.find(
    (target) => target.topology.structureCode === "A",
  );

  assert.equal(root.topology.branchFamily.code, "A");
  assert.deepEqual(
    root.topology.branchFamily.arms.map((arm) => ({
      originPortId: arm.originPortId,
      armIndex: arm.armIndex,
      isOccupied: arm.isOccupied,
    })),
    [
      { originPortId: "branch:1", armIndex: 1, isOccupied: true },
      { originPortId: "branch:2", armIndex: 2, isOccupied: false },
    ],
  );
  assert.equal(branchEdges.length, 2);
  assert.ok(branchTarget);
  assert.match(
    markup,
    /class="graph-family-root family-tone-0"[^>]+data-family-code="A"/,
  );
  assert.match(
    markup,
    /class="open-target is-neutral is-branch-target[^\"]*"[^>]+data-structure-code="A"/,
  );
  assert.doesNotMatch(markup, /class="graph-family-root__code"/);
  assert.doesNotMatch(markup, /graph-structure-marker/);
  assert.doesNotMatch(markup, />[PABCDEFG]<\/text>/);
});

test("una familia cerrada pierde letras redundantes pero conserva inspección", () => {
  const view = structuredClone(projectGraphView(createTopologyScenario()));
  view.roundStatus.phase = "finished";
  view.legalPlays = [];
  const restMarkup = renderGraphSvgMarkup(createGraphScene(view));
  const inspectedMarkup = renderGraphSvgMarkup(createGraphScene(view, {
    inspectedStructureId: "branch-family:placement-1",
    inspectedPlacementId: "placement-4",
  }));

  assert.doesNotMatch(restMarkup, /class="graph-family-root /);
  assert.doesNotMatch(
    restMarkup,
    /class="open-target__structure-code"[^>]*>A<\/text>/,
  );
  assert.match(inspectedMarkup, /class="graph-family-root /);
  assert.doesNotMatch(inspectedMarkup, /class="open-target__structure-code"/);
});

test("sin ficha seleccionada todos los extremos permanecen visibles sin códigos", async () => {
  const scene = createGraphScene(projectGraphView(createTopologyScenario()));
  const markup = renderGraphSvgMarkup(scene);
  const boardCss = await readFile(
    new URL("../../src/css/board.css", import.meta.url),
    "utf8",
  );

  assert.equal(scene.hasSelection, false);
  assert.equal(
    scene.openTargets.every((target) => target.isLegal === false),
    true,
  );
  assert.equal(
    markup.match(/class="open-target is-neutral /g)?.length,
    scene.openTargets.length,
  );
  assert.doesNotMatch(markup, /class="open-target__structure-code"/);
  assert.equal(
    scene.openTargets.filter(
      (target) => target.topology.branchState === "STARTED",
    ).length,
    1,
  );
  assert.equal(
    scene.openTargets.filter(
      (target) => target.topology.branchState === "POTENTIAL",
    ).length,
    1,
  );
  assert.match(markup, /is-branch-target family-tone-0 is-started-arm/);
  assert.match(markup, /is-branch-target family-tone-0 is-potential-arm/);
  assert.match(markup, /<circle class="open-target__end"[^>]+r="10"/);
  assert.match(boardCss, /\.open-target \{[\s\S]+?opacity:\s*1/);
  assert.match(
    boardCss,
    /\.open-target\.is-neutral \.open-target__end[\s\S]+?drop-shadow/,
  );
});

test("al seleccionar ficha los compatibles dominan y muestran opción individual", async () => {
  const state = createTopologyScenario();
  const playerId = findDominoOwner(state, "1-3");
  const legalTargets = getLegalTargetsForDomino(
    state,
    playerId,
    "1-3",
  );
  const scene = createGraphScene(projectGraphView(state, playerId), {
    selectedDominoId: "1-3",
    legalTargets,
  });
  const markup = renderGraphSvgMarkup(scene);
  const boardCss = await readFile(
    new URL("../../src/css/board.css", import.meta.url),
    "utf8",
  );

  assert.equal(legalTargets.length, 2);
  assert.deepEqual(
    scene.openTargets
      .filter((target) => target.isLegal)
      .map((target) => target.topology.structureCode),
    ["P", "A"],
  );
  assert.match(markup, /open-target is-legal is-main-target/);
  assert.match(markup, /open-target is-legal is-branch-target/);
  assert.match(markup, /open-target is-incompatible/);
  assert.match(markup, /class="open-target__option-index"/);
  assert.doesNotMatch(
    markup,
    />\s*S\s*=|>\s*\+\d+\s+puntos|>\s*no puntúa/i,
  );
  assert.match(
    boardCss,
    /\.open-target\.is-incompatible \{[\s\S]+?opacity:\s*0\.12/,
  );
  assert.equal(markup.match(/class="open-target__option-index"/g)?.length, 2);
});

test("los números de opción solo aparecen al distinguir destinos compatibles del mismo valor", () => {
  const state = createTopologyScenario();
  const playerId = findDominoOwner(state, "1-3");
  const view = projectGraphView(state, playerId);
  const oneProjectedTarget = view.openEndsByValue[0].targets[0];
  const restMarkup = renderGraphSvgMarkup(createGraphScene(view));
  const oneTargetMarkup = renderGraphSvgMarkup(createGraphScene(view, {
    selectedDominoId: "ficha-de-prueba",
    legalTargets: [{ id: oneProjectedTarget.id }],
  }));
  const severalTargetsMarkup = renderGraphSvgMarkup(createGraphScene(view, {
    selectedDominoId: "1-3",
    legalTargets: getLegalTargetsForDomino(state, playerId, "1-3"),
  }));

  assert.doesNotMatch(restMarkup, /open-target__option-index/);
  assert.doesNotMatch(oneTargetMarkup, /open-target__option-index/);
  assert.equal(
    severalTargetsMarkup.match(/class="open-target__option-index"/g)?.length,
    2,
  );
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

test("la inspección de familia resalta ambos brazos, su raíz y sus extremos", () => {
  const state = createTwoArmFamilyScenario();
  const scene = createGraphScene(projectGraphView(state), {
    inspectedStructureId: "branch-family:placement-1",
    inspectedPlacementId: "placement-5",
  });
  const played = [...scene.edges, ...scene.loops];
  const byPlacementId = new Map(
    played.map((edge) => [edge.placementId, edge]),
  );
  const markup = renderGraphSvgMarkup(scene);
  const inspector = renderTopologyInspectionMarkup(scene.inspection);

  assert.deepEqual(scene.inspection.structurePlacementIds, [
    "placement-4",
    "placement-5",
  ]);
  assert.deepEqual(
    scene.inspection.arms.map((arm) => arm.isOccupied),
    [true, true],
  );
  assert.equal(scene.inspection.rootPlacementId, "placement-1");
  assert.equal(byPlacementId.get("placement-4").isTopologyHighlighted, true);
  assert.equal(byPlacementId.get("placement-5").isTopologyHighlighted, true);
  assert.equal(byPlacementId.get("placement-1").isTopologyRoot, true);
  assert.equal(byPlacementId.get("placement-1").isTopologyDimmed, false);
  assert.equal(byPlacementId.get("placement-2").isTopologyDimmed, true);
  assert.equal(
    scene.openTargets.find((target) => target.id === "placement-5:side:a")
      .isTopologyHighlighted,
    true,
  );
  assert.equal(
    scene.openTargets.find((target) => target.id === "placement-4:side:a")
      .isTopologyHighlighted,
    true,
  );
  assert.equal(
    scene.openTargets.find((target) => target.id === "placement-3:side:a")
      .isTopologyDimmed,
    true,
  );
  assert.match(
    markup,
    /graph-edge is-branch[^\"]*is-inspected is-topology-highlighted/,
  );
  assert.match(markup, /graph-loop is-main is-special-double is-topology-root/);
  assert.match(inspector, /Nace del chancho 4\|4/);
  assert.match(inspector, /Brazos del chancho ramificador/);
  assert.match(inspector, /2 brazos iniciados/);
  assert.match(inspector, /brazo 2 · posición 1/);
  assert.doesNotMatch(inspector, /branch:1|placement-/);
  assert.match(inspector, /data-clear-topology-inspection/);
});

test("la inspección de chanchos explica rol, conexiones y ramas", () => {
  const specialScene = createGraphScene(
    projectGraphView(createTopologyScenario()),
    {
      inspectedStructureId: "main",
      inspectedPlacementId: "placement-1",
    },
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
      inspectedStructureId: "main",
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
    "0-4",
    targetAt("placement-1", "main:1"),
  );
  branchDoubleState = playDomino(
    branchDoubleState,
    "1-4",
    targetAt("placement-1", "main:2"),
  );
  branchDoubleState = playDomino(
    branchDoubleState,
    "2-4",
    targetAt("placement-1", "branch:1"),
  );
  branchDoubleState = playDomino(
    branchDoubleState,
    "2-2",
    targetAt("placement-4", "side:a"),
  );
  const branchDoubleMarkup = renderTopologyInspectionMarkup(
    createGraphScene(projectGraphView(branchDoubleState), {
      inspectedStructureId: "branch-family:placement-1",
      inspectedPlacementId: "placement-5",
    }).inspection,
  );

  assert.match(specialMarkup, /Chancho ramificador/);
  assert.match(specialMarkup, /Conexiones: 3\/4/);
  assert.match(specialMarkup, /Ramas iniciadas: 1\/2/);
  assert.match(ordinaryMainMarkup, /Chancho ordinario/);
  assert.match(ordinaryMainMarkup, /Conexiones: 1\/2/);
  assert.match(branchDoubleMarkup, /Chancho ordinario/);
  assert.match(branchDoubleMarkup, /Conexiones: 1\/2/);
});

test("el modo estructural se proyecta sin ocupar espacio permanente", () => {
  let state = createBoardScenario({ K: 20, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const scene = createGraphScene(projectGraphView(state));
  const markup = renderGraphSvgMarkup(scene);

  assert.deepEqual(scene.topologySummary, {
    structuralMode: "RAMIFICADO",
    placementId: "placement-1",
    exists: true,
  });
  assert.doesNotMatch(markup, /graph-special-summary|Especiales:/);
});

test("un grafo denso conserva fichas, targets e inspección individual", () => {
  const state = createDenseScenario();
  const view = projectGraphView(state);
  const inspectedTopology = view.topology.placements.find(
    (placement) => placement.placementId === "placement-16",
  );
  const scene = createGraphScene(view, {
    inspectedStructureId: inspectedTopology.familyId,
    inspectedPlacementId: "placement-16",
  });
  const markup = renderGraphSvgMarkup(scene);
  const played = [...scene.edges, ...scene.loops];

  assert.equal(played.length, 17);
  assert.equal(new Set(played.map((edge) => edge.placementId)).size, 17);
  assert.equal(scene.vertices.length, 7);
  assert.equal(scene.openTargets.length, 4);
  assert.equal(new Set(scene.openTargets.map((target) => target.id)).size, 4);
  assert.equal(played.filter((edge) => edge.isTopologyHighlighted).length, 2);
  assert.equal(played.filter((edge) => edge.isTopologyRoot).length, 1);
  assert.equal(played.filter((edge) => edge.isTopologyDimmed).length, 14);
  assert.equal(markup.match(/data-placement-id=/g)?.length, 17);
  assert.equal(markup.match(/class="open-target /g)?.length, 4);
  assert.deepEqual(
    scene.loops
      .map((loop) => loop.topology.branchFamily?.code)
      .filter(Boolean),
    ["A"],
  );
  assert.equal(
    markup.match(/class="graph-family-root /g)?.length,
    1,
  );
  assert.doesNotMatch(markup, /graph-edge__label|graph-loop__label/);
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
  assert.match(
    boardCss,
    /\.graph-edge\.is-main[\s\S]+?stroke-width:\s*6/,
  );
  assert.match(
    boardCss,
    /\.open-target\.is-main-target[\s\S]+?stroke-dasharray:\s*none/,
  );
  assert.match(
    boardCss,
    /\.open-target\.is-branch-target[\s\S]+?stroke-dasharray:\s*6 6/,
  );
  assert.match(
    boardCss,
    /\.open-target\.is-potential-arm \.open-target__curve[\s\S]+?stroke-dasharray:\s*2 7/,
  );
  assert.match(
    boardCss,
    /\.open-target\.is-started-arm \.open-target__end[\s\S]+?fill:/,
  );
  assert.match(boardCss, /\.graph-family-root__code/);
  assert.doesNotMatch(boardCss, /\.graph-family-root__arm/);
  assert.match(boardCss, /\.open-target__structure-code/);
  assert.match(componentsCss, /\.legend-branch[\s\S]+?border-top-style:\s*dashed/);
  assert.doesNotMatch(componentsCss, /\.legend-special/);
});

test("el CSS conserva una presentación táctil y adaptable a teléfono", async () => {
  const boardCss = await readFile(
    new URL("../../src/css/board.css", import.meta.url),
    "utf8",
  );

  assert.match(boardCss, /\.open-target__hit[\s\S]+?stroke-width:\s*44/);
  assert.match(boardCss, /\.graph-edge__hit,[\s\S]+?stroke-width:\s*28/);
  assert.match(boardCss, /@media \(max-width: 36rem\)/);
  assert.match(boardCss, /@media \(prefers-reduced-motion: reduce\)/);
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
