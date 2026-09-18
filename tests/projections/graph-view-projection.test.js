import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyTurnAction,
  getLegalPlayProjection,
  getLegalPlays,
  getLegalTargetsForDomino,
  getOpenEndTargets,
  getOpenEndVisualProjection,
  getScoringProjection,
  getScoringTerms,
  groupOpenEndsByValue,
  projectGraphView,
} from "../../src/js/game/index.js";
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

test("los extremos del mismo valor conservan identidad al agruparse", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const baseTargets = getOpenEndTargets(state);
  const groups = groupOpenEndsByValue(state);
  const visual = getOpenEndVisualProjection(state);

  assert.equal(groups[4].length, 2);
  assert.equal(new Set(groups[4].map((target) => target.id)).size, 2);
  assert.deepEqual(groups[4], baseTargets);
  assert.deepEqual(visual, [
    { value: 4, count: 2, targets: baseTargets },
  ]);
});

test("una ficha jugable conserva todos sus destinos concretos", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const playerId = findDominoOwner(state, "4-5");
  const legalTargets = getLegalTargetsForDomino(state, playerId, "4-5");
  const groupedPlay = getLegalPlayProjection(state, playerId).find(
    (entry) => entry.dominoId === "4-5",
  );
  const enginePlays = getLegalPlays(state, playerId).filter(
    (play) => play.dominoId === "4-5",
  );

  assert.equal(legalTargets.length, 2);
  assert.equal(groupedPlay.legalTargetCount, 2);
  assert.deepEqual(groupedPlay.legalTargets, legalTargets);
  assert.deepEqual(
    legalTargets.map(({ placementId, portId }) => ({ placementId, portId })),
    enginePlays.map(({ target }) => ({
      placementId: target.placementId,
      portId: target.portId,
    })),
  );
});

test("un chancho especial puede proyectar curva libre y aporte cero", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "5-5" });
  state = playDomino(state, "5-5");
  state = playDomino(
    state,
    "1-5",
    targetAt("placement-1", "main:1"),
  );
  state = playDomino(
    state,
    "2-5",
    targetAt("placement-1", "main:2"),
  );
  state = playDomino(
    state,
    "3-5",
    targetAt("placement-1", "branch:1"),
  );
  const openTarget = getOpenEndTargets(state).find(
    (target) =>
      target.placementId === "placement-1" &&
      target.portId === "branch:2",
  );
  const doubleTerm = getScoringProjection(state).terms.find(
    (term) => term.placementId === "placement-1",
  );

  assert.ok(openTarget);
  assert.equal(
    groupOpenEndsByValue(state)[5].some(
      (target) => target.id === openTarget.id,
    ),
    true,
  );
  assert.equal(doubleTerm.connectionCount, 3);
  assert.equal(doubleTerm.contribution, 0);
});

test("la proyección de puntuación reutiliza términos y agrupa contribuciones", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-3" });
  state = playDomino(state, "2-3");
  state = playDomino(state, "2-5", (target) => target.value === 2);
  state = playDomino(state, "3-5", (target) => target.value === 3);
  const projection = getScoringProjection(state);

  assert.deepEqual(projection.terms, getScoringTerms(state));
  assert.equal(projection.sum, 10);
  assert.deepEqual(projection.contributionGroups, [
    { contribution: 5, count: 2, subtotal: 10 },
  ]);
  assert.equal("scoreAwardedIfMoveEndedHere" in projection, false);
});

test("la fachada compuesta conserva grafo terminal y elimina jugadas", () => {
  const active = createExitTurnState();
  const action = getLegalPlays(active, active.currentPlayerId).find(
    (play) => play.dominoId === "0-5",
  );
  const finished = applyTurnAction(active, action);
  const projection = projectGraphView(finished, finished.currentPlayerId);

  assert.equal(projection.roundStatus.phase, "finished");
  assert.deepEqual(projection.roundStatus.roundResult, finished.roundResult);
  assert.deepEqual(projection.roundStatus.scoreByTeam, finished.score.teams);
  assert.equal(projection.edges.length, Object.keys(finished.board.placements).length);
  assert.deepEqual(projection.legalPlays, []);
  assert.equal(projection.hand.every((domino) => domino.legalTargetCount === 0), true);
  assert.equal(projection.turn.isCurrentPlayer, false);
  assert.ok(projection.openEndsByValue.length > 0);
});

test("todas las proyecciones son inmutables respecto del snapshot", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const before = structuredClone(state);
  const playerId = findDominoOwner(state, "4-5");
  const projection = projectGraphView(state, playerId);

  projection.vertices[4].openTargetCount = 999;
  projection.openEndsByValue[0].targets[0].value = 999;
  projection.hand[0].legalTargetCount = 999;
  projection.roundStatus.scoreByTeam.A = 999;

  assert.deepEqual(state, before);
});

test("la capa de proyección no contiene DOM, renderizado ni coordenadas", async () => {
  const moduleUrls = [
    new URL("../../src/js/game/projections/ValueGraphProjection.js", import.meta.url),
    new URL("../../src/js/game/projections/OpenEndProjection.js", import.meta.url),
    new URL("../../src/js/game/projections/LegalPlayProjection.js", import.meta.url),
    new URL("../../src/js/game/projections/ScoringProjection.js", import.meta.url),
    new URL("../../src/js/game/projections/TopologyProjection.js", import.meta.url),
    new URL("../../src/js/game/projections/GraphViewProjection.js", import.meta.url),
  ];
  const forbidden = [
    /\bdocument\b/,
    /\bwindow\b/,
    /\bcanvas\b/i,
    /\bsvg\b/i,
    /\banimation\b/i,
    /\b(?:x|y)\s*:/,
  ];

  for (const moduleUrl of moduleUrls) {
    const source = await readFile(moduleUrl, "utf8");
    for (const pattern of forbidden) {
      assert.equal(pattern.test(source), false, `${moduleUrl.pathname}: ${pattern}`);
    }
  }
});
