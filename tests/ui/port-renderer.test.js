import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyTurnAction,
  getLegalPlays,
  getLegalTargetsForDomino,
  projectPortView,
} from "../../src/js/game/index.js";
import {
  analyzePortSceneDensity,
  createPortScene,
  PORT_SCENE_LAYOUTS,
} from "../../src/js/ui/PortScene.js";
import {
  renderPortNodeInspectorMarkup,
  renderPortSvgMarkup,
} from "../../src/js/ui/PortRenderer.js";
import {
  createBoardScenario,
  findDominoOwner,
  playDomino,
} from "../fixtures/board-scenarios.js";
import { createExitTurnState } from "../fixtures/turn-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

function createTwoArmScenario() {
  let state = createBoardScenario({ K: 7, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "3-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "1-2", targetAt("placement-3", "side:a"));
  state = playDomino(state, "0-4", targetAt("placement-1", "branch:2"));
  return state;
}

function createTwelveThreadScenario() {
  let state = createBoardScenario({ K: 0, firstDominoId: "1-6" });
  state = playDomino(state, "1-6");
  for (const [dominoId, value] of [
    ["1-4", 1],
    ["0-4", 4],
    ["0-2", 0],
    ["2-5", 2],
    ["3-5", 5],
    ["1-3", 3],
    ["1-2", 1],
    ["2-4", 2],
    ["4-6", 4],
    ["0-6", 6],
    ["0-5", 0],
  ]) {
    state = playDomino(state, dominoId, (target) => target.value === value);
  }
  return state;
}

function countStraightCrossings(threads) {
  function orientation(first, second, third) {
    return (second.x - first.x) * (third.y - first.y) -
      (second.y - first.y) * (third.x - first.x);
  }
  let crossings = 0;
  for (let firstIndex = 0; firstIndex < threads.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < threads.length; secondIndex += 1) {
      const first = threads[firstIndex];
      const second = threads[secondIndex];
      if ([first.a, first.b].some((value) => value === second.a || value === second.b)) {
        continue;
      }
      if (
        orientation(first.route.start, first.route.end, second.route.start) *
          orientation(first.route.start, first.route.end, second.route.end) < 0 &&
        orientation(second.route.start, second.route.end, first.route.start) *
          orientation(second.route.start, second.route.end, first.route.end) < 0
      ) {
        crossings += 1;
      }
    }
  }
  return crossings;
}

test("la escena vacía conserva siete sacos y cuarenta y dos puertos potenciales", () => {
  const state = createBoardScenario();
  const scene = createPortScene(projectPortView(state));
  const markup = renderPortSvgMarkup(scene);

  assert.equal(scene.nodes.length, 7);
  assert.equal(scene.nodes.flatMap((node) => node.ordinaryPorts).length, 42);
  assert.equal(scene.threads.length, 0);
  assert.equal(scene.bridges.length, 0);
  assert.equal(markup.match(/aria-label="Valor \d;/g)?.length, 7);
  assert.equal(markup.match(/port-incidence is-potential/g)?.length ?? 0, 0);
  assert.match(markup, /class="port-cover"[\s\S]*?aria-label="Ver estructura"/);
  assert.equal(scene.visualState, "play");
});

test("hilos exteriores y costuras interiores se materializan por separado", () => {
  let state = createBoardScenario({ firstDominoId: "1-6" });
  state = playDomino(state, "1-6");
  state = playDomino(state, "1-4", (target) => target.value === 1);
  const scene = createPortScene(projectPortView(state));
  const markup = renderPortSvgMarkup(scene);
  const structureMarkup = renderPortSvgMarkup(createPortScene(
    projectPortView(state),
    { showStructure: true },
  ));

  assert.equal(scene.threads.length, 2);
  assert.equal(scene.bridges.length, 1);
  assert.equal(scene.bridges[0].value, 1);
  assert.doesNotMatch(markup, /class="port-thread is-main(?:\s|")/);
  assert.doesNotMatch(markup, /class="port-bridge is-main(?:\s|")/);
  assert.match(structureMarkup, /class="port-thread is-main(?:\s|")/);
  assert.match(structureMarkup, /class="port-bridge is-main(?:\s|")/);
  assert.ok(scene.threads.every((thread) => thread.path.includes(" Q ")));
  assert.doesNotMatch(markup, />\s*S\s*=|>\s*\+\d+\s+puntos/i);
});

test("un especial se ve como un único hub de cuatro sockets", () => {
  let state = createBoardScenario({ K: 7, firstDominoId: "5-5" });
  state = playDomino(state, "5-5");
  const scene = createPortScene(projectPortView(state));
  const markup = renderPortSvgMarkup(scene);

  assert.equal(scene.hubs.length, 1);
  assert.equal(scene.hubs[0].sockets.length, 4);
  assert.equal(scene.openTargets.length, 4);
  assert.match(markup, /port-double-hub is-special/);
  assert.equal(markup.match(/port-double-hub__socket is-open/g)?.length, 4);
});

test("targets repetidos mantienen placementId + portId y numeración temporal", () => {
  let state = createBoardScenario({ K: 7, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const playerId = findDominoOwner(state, "4-5");
  const legalTargets = getLegalTargetsForDomino(state, playerId, "4-5");
  const scene = createPortScene(projectPortView(state, playerId), {
    selectedDominoId: "4-5",
    legalTargets,
  });
  const markup = renderPortSvgMarkup(scene);

  assert.equal(scene.openTargets.filter((target) => target.isLegal).length, 4);
  assert.deepEqual(
    scene.openTargets.map((target) => ({
      placementId: target.placementId,
      portId: target.portId,
    })),
    legalTargets.map((target) => ({
      placementId: target.placementId,
      portId: target.portId,
    })),
  );
  assert.deepEqual(
    scene.openTargets.map(({ optionIndex }) => optionIndex),
    [1, 2, 3, 4],
  );
  assert.equal(markup.match(/port-open-target__option/g)?.length, 4);
});

test("sin selección los extremos reales brillan y no aparecen opciones", () => {
  const state = createTwoArmScenario();
  const scene = createPortScene(projectPortView(state));
  const markup = renderPortSvgMarkup(scene);

  assert.ok(scene.openTargets.length > 0);
  assert.ok(scene.openTargets.every((target) => !target.isLegal));
  assert.equal(
    markup.match(/class="port-open-target is-neutral/g)?.length,
    scene.openTargets.length,
  );
  assert.equal(
    markup.match(/port-open-target__tail/g)?.length,
    scene.openTargets.length,
  );
  assert.doesNotMatch(markup, /port-open-target__option/);
});

test("inspeccionar una rama destaca ambos brazos, costuras y chancho raíz", () => {
  const state = createTwoArmScenario();
  const scene = createPortScene(projectPortView(state), {
    inspectedStructureId: "branch-family:placement-1",
    inspectedPlacementId: "placement-3",
  });

  assert.equal(
    scene.threads.filter((thread) => thread.isTopologyHighlighted).length,
    3,
  );
  assert.equal(
    scene.bridges.filter((bridge) => bridge.isTopologyHighlighted).length,
    3,
  );
  assert.equal(
    scene.hubs.find((hub) => hub.placementId === "placement-1").isTopologyRoot,
    true,
  );
  assert.ok(scene.threads.some((thread) => thread.isTopologyDimmed));
});

test("inspeccionar principal atenúa ramas sin perder sus incidencias", () => {
  const state = createTwoArmScenario();
  const scene = createPortScene(projectPortView(state), {
    inspectedStructureId: "main",
  });

  assert.ok(
    scene.threads
      .filter((thread) => thread.topology.region === "main")
      .every((thread) => thread.isTopologyHighlighted),
  );
  assert.ok(
    scene.threads
      .filter((thread) => thread.topology.region === "branch")
      .every((thread) => thread.isTopologyDimmed),
  );
  assert.equal(scene.nodes.length, 7);
});

test("inspeccionar un brazo exacto no mezcla el otro brazo de la familia", () => {
  const state = createTwoArmScenario();
  const scene = createPortScene(projectPortView(state), {
    inspectedRouteId: "placement-1:branch:1",
  });

  assert.equal(scene.visualState, "route");
  assert.ok(
    scene.threads
      .filter((thread) => thread.topology.structureId === "placement-1:branch:1")
      .every((thread) => thread.isTopologyHighlighted),
  );
  assert.ok(
    scene.threads
      .filter((thread) => thread.topology.structureId === "placement-1:branch:2")
      .every((thread) => thread.isTopologyDimmed),
  );
  assert.equal(
    scene.hubs.find((hub) => hub.placementId === "placement-1").isTopologyRoot,
    true,
  );
  assert.equal(scene.hubs.filter((hub) => hub.isTopologyRoot).length, 1);
});

test("un brazo potencial solo señala su propio hub raíz entre varios especiales", () => {
  let state = createBoardScenario({ K: 7, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "3-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "3-3", (target) => target.value === 3);
  const scene = createPortScene(projectPortView(state), {
    inspectedRouteId: "placement-1:branch:1",
  });

  assert.equal(scene.hubs.length, 2);
  assert.deepEqual(
    scene.hubs
      .filter((hub) => hub.isTopologyRoot)
      .map((hub) => hub.placementId),
    ["placement-1"],
  );
  assert.equal(
    scene.hubs.find((hub) => hub.placementId === "placement-1").isTopologyDimmed,
    false,
  );
});

test("abrir un macro-nodo muestra todas sus parejas sin duplicar el valor", () => {
  const state = createTwoArmScenario();
  const scene = createPortScene(projectPortView(state), {
    expandedNodeValue: 4,
  });
  const inspector = renderPortNodeInspectorMarkup(scene.nodeInspector);

  assert.equal(scene.nodes.filter((node) => node.value === 4).length, 1);
  assert.equal(scene.nodeInspector.value, 4);
  assert.equal(scene.nodeInspector.hubs[0].capacity, 4);
  assert.ok(scene.nodeInspector.bridges.length >= 3);
  assert.equal(scene.nodeFocus.ports.length, 6);
  assert.equal(scene.nodeFocus.value, 4);
  assert.equal(scene.visualState, "node-focus");
  assert.match(inspector, /3 de 6 ojales utilizados/);
  assert.match(inspector, /Chancho 4\|4: especial/);
  assert.match(inspector, /chancho · (principal|lateral)/);
  assert.doesNotMatch(inspector, /main:|branch:|side:/);
  assert.doesNotMatch(inspector, /placement-|connection-/);

  const markup = renderPortSvgMarkup(scene);
  assert.match(markup, /role="dialog" aria-label="Detalle ampliado del valor 4"/);
  assert.equal(markup.match(/port-focus__port-label/g)?.length, 6);
  assert.match(markup, /Conexiones de 4/);
  assert.equal(markup.match(/data-close-port-node/g)?.length, 1);
  assert.doesNotMatch(inspector, /data-close-port-node/);
});

test("jugar, decisión, recorrido y estructura exponen revelado progresivo", () => {
  const state = createTwoArmScenario();
  const view = projectPortView(state);
  const rest = createPortScene(view);
  const playerId = findDominoOwner(state, "3-5");
  const decision = createPortScene(projectPortView(state, playerId), {
    selectedDominoId: "3-5",
    legalTargets: getLegalTargetsForDomino(state, playerId, "3-5"),
  });
  const inspection = createPortScene(view, {
    inspectedRouteId: "placement-1:branch:1",
  });
  const structure = createPortScene(view, { showStructure: true });

  assert.equal(rest.visualState, "play");
  assert.equal(decision.visualState, "decision");
  assert.equal(inspection.visualState, "route");
  assert.equal(structure.visualState, "structure");
  assert.ok(rest.threads.some((thread) => !thread.isLive));
  assert.ok(decision.openTargets.some((target) => target.isLegal));
  assert.match(renderPortSvgMarkup(decision), /port-graph is-decision/);
  assert.equal(renderPortSvgMarkup(rest).match(/class="port-thread /g)?.length ?? 0, 0);
  assert.equal(
    renderPortSvgMarkup(inspection).match(/class="port-thread /g)?.length,
    inspection.threads.filter((thread) => thread.isTopologyHighlighted).length,
  );
  assert.equal(
    renderPortSvgMarkup(structure).match(/class="port-thread /g)?.length,
    structure.threads.length,
  );
  assert.match(renderPortSvgMarkup(structure), /aria-label="Volver a jugar"/);
});

test("la tapa presenta scoring real y desaparece cuando no hay resolución", () => {
  const view = projectPortView(createTwoArmScenario());
  const contributingTarget = view.portGraph.openTargets[0];
  const scoringResolution = {
    terms: [{
      placementId: contributingTarget.placementId,
      portId: contributingTarget.portId,
      isDouble: false,
      contribution: contributingTarget.value,
    }],
    expression: "5 + 3 + 2",
    sum: 10,
    divisor: 5,
    isDivisible: true,
    quotient: 2,
    scoreAwarded: 2,
  };
  const scoredMarkup = renderPortSvgMarkup(createPortScene(view, {
    scoringResolution,
  }));
  const disabledMarkup = renderPortSvgMarkup(createPortScene(view));

  assert.match(scoredMarkup, /port-cover__scoring/);
  assert.match(scoredMarkup, />5 \+ 3 \+ 2</);
  assert.match(scoredMarkup, />10 = 5 × 2</);
  assert.match(scoredMarkup, />\+2 puntos</);
  const scoredScene = createPortScene(view, { scoringResolution });
  assert.equal(
    scoredScene.openTargets.filter((target) => target.isScoringTerm).length,
    1,
  );
  assert.doesNotMatch(disabledMarkup, /port-cover__scoring/);
  assert.doesNotMatch(disabledMarkup, /múltiplo de/);
});

test("un especial con extremos libres mantiene scoring y targets separados", () => {
  let state = createBoardScenario({ K: 7, firstDominoId: "5-5" });
  state = playDomino(state, "5-5");
  const view = projectPortView(state);
  const scene = createPortScene(view, {
    scoringResolution: {
      terms: [{
        placementId: "placement-1",
        portId: null,
        isDouble: true,
        contribution: 0,
      }],
      expression: "0",
      sum: 0,
      divisor: 5,
      isDivisible: true,
      quotient: 0,
      scoreAwarded: 0,
    },
  });

  assert.equal(scene.openTargets.length, 4);
  assert.equal(scene.openTargets.filter((target) => target.isScoringTerm).length, 0);
  assert.equal(scene.hubs.filter((hub) => hub.isScoringTerm).length, 1);
});

test("crear los cuatro niveles visuales no modifica el snapshot", () => {
  const state = createTwoArmScenario();
  const before = structuredClone(state);
  const view = projectPortView(state);

  createPortScene(view);
  createPortScene(view, { showStructure: true });
  createPortScene(view, { inspectedRouteId: "placement-1:branch:1" });
  createPortScene(view, { expandedNodeValue: 4 });

  assert.deepEqual(state, before);
});

test("el análisis de densidad separa información primaria y secundaria", () => {
  const scene = createPortScene(projectPortView(createTwoArmScenario()));
  const density = analyzePortSceneDensity(scene);

  assert.equal(density.threadCount, scene.threads.length);
  assert.equal(density.bridgeCount, scene.bridges.length);
  assert.equal(density.openEndCount, scene.openTargets.length);
  assert.equal(density.potentialPorts + density.usedPorts, 42);
  assert.ok(Number.isInteger(density.estimatedThreadCrossings));
  assert.ok(density.primaryMarks > 0);
  assert.ok(density.secondaryMarks > 0);
});

test("los carriles anulares reducen cruces frente a los hilos rectos del fixture largo", () => {
  const scene = createPortScene(projectPortView(createTwelveThreadScenario()));
  const density = analyzePortSceneDensity(scene);
  const straightCrossings = countStraightCrossings(scene.threads);

  assert.equal(scene.threads.length, 12);
  assert.ok(straightCrossings > 0);
  assert.ok(density.estimatedThreadCrossings < straightCrossings);
  assert.ok(scene.threads.every((thread) => thread.path.includes(" Q ")));
});

test("los layouts conservan heptágono legible sin achatamiento extremo", () => {
  const view = projectPortView(createTwoArmScenario());
  const compact = createPortScene(view, { layout: PORT_SCENE_LAYOUTS.COMPACT });
  const wide = createPortScene(view, { layout: PORT_SCENE_LAYOUTS.WIDE });

  assert.equal(compact.nodes.length, 7);
  assert.equal(wide.nodes.length, 7);
  assert.ok(compact.orbit.rx / compact.orbit.ry < 1.1);
  assert.ok(wide.orbit.rx / wide.orbit.ry < 1.3);
  assert.ok(compact.width <= 760);
  assert.ok(wide.threads.every((thread) => thread.lane === "inner" || thread.lane === "outer"));
});

test("la hoja visual reserva potenciales para detalle y respeta movimiento reducido", async () => {
  const css = await readFile(
    new URL("../../src/css/ports.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /\.port-incidence\.is-potential[\s\S]*?opacity:\s*0\.1/);
  assert.match(css, /\.port-thread\.is-live[\s\S]*?opacity:\s*0\.72/);
  assert.match(css, /\.port-graph\.is-node-focus \.port-scene-base/);
  assert.match(css, /\.port-open-target__tail/);
  assert.match(css, /\.port-cover__scoring/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("la proyección y renderer de Puertos no leen board ni contienen reglas", async () => {
  const projectionSource = await readFile(
    new URL("../../src/js/game/projections/PortGraphProjection.js", import.meta.url),
    "utf8",
  );
  for (const moduleUrl of [
    new URL("../../src/js/ui/PortScene.js", import.meta.url),
    new URL("../../src/js/ui/PortRenderer.js", import.meta.url),
  ]) {
    const source = await readFile(moduleUrl, "utf8");
    assert.doesNotMatch(source, /\bstate\.board\b|\bview\.board\b/);
    assert.doesNotMatch(source, /applyTurnAction|getLegalPlays|getScoringTerms/);
  }
  assert.doesNotMatch(projectionSource, /\bdocument\b|\bwindow\b|\bSVG\b/);
  assert.doesNotMatch(projectionSource, /\bx\s*:|\by\s*:|angle|coordinate/i);
});

test("la vista terminal conserva Puertos y elimina jugadas", () => {
  const active = createExitTurnState();
  const terminal = applyTurnAction(
    active,
    getLegalPlays(active, active.currentPlayerId)[0],
  );
  const view = projectPortView(terminal);
  const scene = createPortScene(view);

  assert.equal(view.roundStatus.phase, "finished");
  assert.deepEqual(view.legalPlays, []);
  assert.equal(scene.nodes.length, 7);
  assert.equal(
    scene.threads.length + scene.hubs.length,
    Object.keys(terminal.board.placements).length,
  );
  assert.equal(scene.canStart, false);
});
