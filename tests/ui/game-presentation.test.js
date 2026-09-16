import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { projectGraphView } from "../../src/js/game/index.js";
import { getGameFeedback } from "../../src/js/ui/GameFeedback.js";
import { renderPipsMarkup } from "../../src/js/ui/DominoPips.js";
import { getRoundResultPresentation } from "../../src/js/ui/ScorePanel.js";
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
    scoringPresentation: {
      latestResolution: {
        sequence: 1,
        placementId: "placement-1",
        terms: [],
        expression: "5 + 5",
        sum: 10,
        divisor: 5,
        isDivisible: true,
        quotient: 2,
        scoreAwarded: 2,
      },
    },
  });

  assert.equal(feedback.sequence, 1);
  assert.equal(feedback.scoreAwarded, 2);
  assert.match(feedback.message, /^\+2 puntos para /);
  assert.equal(feedback.scoring.expression, "5 + 5");
  assert.equal(feedback.scoring.quotient, 2);
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

  assert.equal(feedback.openedBranchFamily, "Nuevo brazo");
  assert.match(feedback.message, /Nuevo brazo abierto/);
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

test("la jerarquía game-first compacta chrome y acerca tablero y mano", async () => {
  const [html, layoutCss, componentsCss, boardCss, traditionalCss, portsCss, mainSource, turnSource] =
    await Promise.all([
      readFile(new URL("../../index.html", import.meta.url), "utf8"),
      readFile(new URL("../../src/css/layout.css", import.meta.url), "utf8"),
      readFile(new URL("../../src/css/components.css", import.meta.url), "utf8"),
      readFile(new URL("../../src/css/board.css", import.meta.url), "utf8"),
      readFile(new URL("../../src/css/traditional.css", import.meta.url), "utf8"),
      readFile(new URL("../../src/css/ports.css", import.meta.url), "utf8"),
      readFile(new URL("../../src/js/main.js", import.meta.url), "utf8"),
      readFile(new URL("../../src/js/ui/TurnIndicator.js", import.meta.url), "utf8"),
    ]);

  assert.match(layoutCss, /grid-template-areas:\s*\n\s*"board action"\s*\n\s*"board hand"\s*\n\s*"sidebar sidebar"/);
  assert.match(layoutCss, /@media \(max-width: 58rem\) and \(orientation: portrait\)[\s\S]+?"board"[\s\S]+?"action"[\s\S]+?"hand"/);
  assert.match(layoutCss, /\.play-layout:has\(\.round-result:not\(\[hidden\]\)\)[\s\S]+?grid-template-areas:\s*"board sidebar"/);
  assert.match(layoutCss, /\.play-layout:has\(\.round-result:not\(\[hidden\]\)\) \.round-actions[\s\S]+?grid-template-columns:\s*1fr 1fr/);
  assert.match(componentsCss, /\.player-counts \{[\s\S]+?display:\s*flex/);
  assert.match(componentsCss, /\.hand-grid \{[\s\S]+?flex-wrap:\s*wrap/);
  assert.match(componentsCss, /\.turn-action-panel \{[\s\S]+?display:\s*flex/);
  assert.match(boardCss, /height:\s*clamp\(26rem, calc\(100vh - 10\.5rem\), 39rem\)/);
  assert.match(traditionalCss, /background-size:\s*4rem 4rem/);
  assert.match(traditionalCss, /\.traditional-table__surface \{[\s\S]+?isolation:\s*isolate/);
  assert.match(traditionalCss, /\.traditional-connection \{[\s\S]+?z-index:\s*1/);
  assert.match(traditionalCss, /\.traditional-domino \{[\s\S]+?z-index:\s*10/);
  assert.match(traditionalCss, /\.traditional-target \{[\s\S]+?z-index:\s*5/);
  assert.match(traditionalCss, /\.traditional-table__canvas \{[\s\S]+?margin-inline:\s*auto/);
  assert.match(portsCss, /\.port-open-target__hit \{[\s\S]+?fill:\s*none[\s\S]+?stroke-width:\s*32[\s\S]+?pointer-events:\s*stroke/);
  assert.match(portsCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /Tradicional[\s\S]+Puertos[\s\S]+Grafo/);
  assert.doesNotMatch(traditionalCss, /rgb\(255 255 255 \/ 0\.24\)/);
  assert.doesNotMatch(html, /De las demás manos solo se muestra la cantidad/);
  assert.doesNotMatch(html, />Suma abierta<|>Marcador<|>Siguiente turno</);
  assert.match(html, /id="selection-hint"[^>]+hidden/);
  assert.match(html, /id="pass-action"[^>]+hidden/);
  assert.match(layoutCss, /grid-template-columns:\s*minmax\(0, 1\.45fr\) minmax\(20rem, 0\.75fr\)/);
  assert.match(componentsCss, /\.graph-stage > \.panel-heading[\s\S]+?justify-content:\s*flex-end/);
  assert.doesNotMatch(html, /Nueva partida independiente|Prototipo/);
  assert.match(componentsCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(mainSource, /lastFeedbackSequence/);
  assert.match(mainSource, /window\.setTimeout[\s\S]+?2100/);
  assert.match(mainSource, /handPanel\.hidden\s*=\s*presentation\.isFinished/);
  assert.match(mainSource, /passButton\.hidden\s*=\s*!presentation\.canPass/);
  assert.doesNotMatch(turnSource, /Acción \$\{/);
  assert.match(turnSource, /consecutivePasses > 0/);
  assert.doesNotMatch(mainSource, /state\.board|applyTurnAction|calculateMoveScore/);
  assert.doesNotMatch(mainSource, /Vista de grafo activa|Vista tradicional activa/);
  assert.match(mainSource, /renderTurnAction\(turnActionSummary, presentation\)/);
});

test("el resultado prioriza ganador final y deja vencedor tradicional como explicación", () => {
  const presentation = getRoundResultPresentation({
    participants: {
      teams: [
        { teamId: "A", displayName: "Órbita", score: 9 },
        { teamId: "B", displayName: "Vector", score: 5 },
      ],
    },
    roundStatus: {
      roundResult: {
        reason: "EMPTY_HAND",
        traditionalWinnerTeamId: "B",
        finalBonus: 1,
        winnerTeamId: "A",
        isTie: false,
      },
    },
  });

  assert.equal(presentation.headline, "ÓRBITA GANA");
  assert.equal(presentation.scoreLine, "9 – 5");
  assert.equal(presentation.traditionalWinner, "Vector");
  assert.equal(presentation.finalBonus, 1);
});

test("el empate final se presenta sin inventar ganador", () => {
  const presentation = getRoundResultPresentation({
    participants: {
      teams: [
        { teamId: "A", displayName: "Órbita", score: 7 },
        { teamId: "B", displayName: "Vector", score: 7 },
      ],
    },
    roundStatus: {
      roundResult: {
        reason: "BLOCKED",
        traditionalWinnerTeamId: null,
        finalBonus: 0,
        winnerTeamId: null,
        isTie: true,
      },
    },
  });

  assert.equal(presentation.headline, "EMPATE FINAL");
  assert.equal(presentation.scoreLine, "7 – 7");
  assert.equal(presentation.winnerTeamId, null);
  assert.equal(presentation.traditionalWinner, "ninguno");
});

test("la mano reutiliza puntos de dominó y omite el texto redundante de un destino", async () => {
  const [handSource, componentsCss] = await Promise.all([
    readFile(new URL("../../src/js/ui/HandRenderer.js", import.meta.url), "utf8"),
    readFile(new URL("../../src/css/components.css", import.meta.url), "utf8"),
  ]);
  const six = renderPipsMarkup(6, {
    gridClass: "test-grid",
    pipClass: "test-pip",
  });

  assert.equal(six.match(/test-pip is-visible/g)?.length, 6);
  assert.match(handSource, /hand-domino__tile/);
  assert.match(handSource, /legalTargetCount > 1/);
  assert.doesNotMatch(handSource, /1 destino/);
  assert.match(componentsCss, /\.hand-domino__tile \{[\s\S]+?border:\s*2px solid/);
  assert.match(componentsCss, /\.hand-domino__pips \{[\s\S]+?repeat\(3, 1fr\)/);
});
