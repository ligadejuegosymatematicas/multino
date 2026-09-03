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

test("la escena vacía conserva siete sacos y cuarenta y dos puertos potenciales", () => {
  const state = createBoardScenario();
  const scene = createPortScene(projectPortView(state));
  const markup = renderPortSvgMarkup(scene);

  assert.equal(scene.nodes.length, 7);
  assert.equal(scene.nodes.flatMap((node) => node.ordinaryPorts).length, 42);
  assert.equal(scene.threads.length, 0);
  assert.equal(scene.bridges.length, 0);
  assert.equal(markup.match(/<g class="port-macro-node/g)?.length, 7);
  assert.equal(markup.match(/class="port-incidence is-potential"/g)?.length, 42);
});

test("hilos exteriores y costuras interiores se materializan por separado", () => {
  let state = createBoardScenario({ firstDominoId: "1-6" });
  state = playDomino(state, "1-6");
  state = playDomino(state, "1-4", (target) => target.value === 1);
  const scene = createPortScene(projectPortView(state));
  const markup = renderPortSvgMarkup(scene);

  assert.equal(scene.threads.length, 2);
  assert.equal(scene.bridges.length, 1);
  assert.equal(scene.bridges[0].value, 1);
  assert.match(markup, /class="port-thread is-main"/);
  assert.match(markup, /class="port-bridge is-main"/);
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
  assert.match(inspector, /Saco abierto/);
  assert.match(inspector, /Chancho 4\|4: especial/);
  assert.match(inspector, /chancho · (principal|lateral)/);
  assert.doesNotMatch(inspector, /main:|branch:|side:/);
  assert.doesNotMatch(inspector, /placement-|connection-/);
});

test("los layouts conservan heptágono legible sin achatamiento extremo", () => {
  const view = projectPortView(createTwoArmScenario());
  const compact = createPortScene(view, { layout: PORT_SCENE_LAYOUTS.COMPACT });
  const wide = createPortScene(view, { layout: PORT_SCENE_LAYOUTS.WIDE });

  assert.equal(compact.nodes.length, 7);
  assert.equal(wide.nodes.length, 7);
  assert.ok(compact.orbit.rx / compact.orbit.ry < 1.1);
  assert.ok(wide.orbit.rx / wide.orbit.ry < 1.3);
  assert.ok(compact.width <= 720);
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
