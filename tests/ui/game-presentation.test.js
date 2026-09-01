import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { projectGraphView } from "../../src/js/game/index.js";
import { getGameFeedback } from "../../src/js/ui/GameFeedback.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

test("el feedback puntuable deriva equipo y puntos de la acción aceptada", () => {
  const feedback = getGameFeedback({
    latestAction: {
      sequence: 1,
      playerId: "P1",
      teamId: "A",
      type: "PLAY_DOMINO",
      placementId: "placement-1",
      scoreAwarded: 2,
      endedRound: false,
    },
    participants: {
      teams: [{ teamId: "A", displayName: "Órbita" }],
    },
    topology: {
      placements: [{ placementId: "placement-1", region: "main", depth: null }],
    },
  });

  assert.equal(feedback.sequence, 1);
  assert.equal(feedback.scoreAwarded, 2);
  assert.match(feedback.message, /^\+2 puntos para /);
  assert.equal(feedback.openedBranchFamily, null);
});

test("la primera ficha lateral produce feedback de nueva ramificación", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(
    state,
    "2-4",
    targetAt("placement-1", "branch:1"),
  );

  const feedback = getGameFeedback(projectGraphView(state));

  assert.equal(feedback.openedBranchFamily, "Ramificación A");
  assert.match(feedback.message, /Ramificación A abierta/);
});

test("PASS no inventa puntos ni un mensaje estructural", () => {
  const feedback = getGameFeedback({
    latestAction: {
      sequence: 8,
      playerId: "P2",
      teamId: "B",
      type: "PASS",
      endedRound: false,
    },
    participants: {
      teams: [{ teamId: "B", displayName: "Vector" }],
    },
    topology: { placements: [] },
  });

  assert.equal(feedback.scoreAwarded, 0);
  assert.equal(feedback.openedBranchFamily, null);
  assert.equal(feedback.message, "");
});

test("la jerarquía compacta prioriza tablero y mano sin overflow global", async () => {
  const [html, layoutCss, componentsCss, boardCss, traditionalCss, mainSource] =
    await Promise.all([
      readFile(new URL("../../index.html", import.meta.url), "utf8"),
      readFile(new URL("../../src/css/layout.css", import.meta.url), "utf8"),
      readFile(new URL("../../src/css/components.css", import.meta.url), "utf8"),
      readFile(new URL("../../src/css/board.css", import.meta.url), "utf8"),
      readFile(new URL("../../src/css/traditional.css", import.meta.url), "utf8"),
      readFile(new URL("../../src/js/main.js", import.meta.url), "utf8"),
    ]);

  assert.match(layoutCss, /grid-template-areas:\s*\n\s*"board"\s*\n\s*"hand"\s*\n\s*"sidebar"/);
  assert.match(componentsCss, /\.player-counts \{[\s\S]+?display:\s*flex/);
  assert.match(componentsCss, /\.hand-grid \{[\s\S]+?repeat\(7/);
  assert.match(componentsCss, /@media \(max-width: 36rem\)[\s\S]+?repeat\(4/);
  assert.match(boardCss, /height:\s*clamp\(20rem, 44vh, 26rem\)/);
  assert.match(traditionalCss, /background-size:\s*3rem 3rem/);
  assert.match(traditionalCss, /\.traditional-table__canvas \{[\s\S]+?margin-inline:\s*auto/);
  assert.doesNotMatch(traditionalCss, /rgb\(255 255 255 \/ 0\.24\)/);
  assert.match(html, /De las demás manos solo se muestra la cantidad/);
  assert.doesNotMatch(html, /Nueva partida independiente|Prototipo/);
  assert.match(componentsCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(mainSource, /lastFeedbackSequence/);
  assert.match(mainSource, /window\.setTimeout[\s\S]+?1800/);
  assert.doesNotMatch(mainSource, /state\.board|applyTurnAction|calculateMoveScore/);
});
