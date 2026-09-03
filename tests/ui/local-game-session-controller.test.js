import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createMatch,
  getAvailableActions,
} from "../../src/js/game/index.js";
import {
  LOCAL_GAME_SCREENS,
  LocalGameSessionController,
} from "../../src/js/ui/LocalGameSessionController.js";
import {
  BOARD_VIEW_MODES,
} from "../../src/js/ui/ViewModeController.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

function createSession(overrides = {}) {
  return new LocalGameSessionController({
    participants: createValidParticipantInput(),
    randomSourceFactory: () => () => 0.999999,
    ...overrides,
  });
}

function finishCurrentGame(session) {
  for (let actionCount = 0; actionCount < 100; actionCount += 1) {
    const state = session.getRoundState();
    if (state.phase === "finished") {
      return state;
    }
    session.revealCurrentHand();
    const action = getAvailableActions(state)[0];
    if (action.type === "PASS") {
      session.pass();
    } else {
      session.selectDomino(action.dominoId);
      session.submitTarget(action.target);
    }
  }
  throw new Error("La partida automática no terminó en 100 acciones.");
}

test("la aplicación inicia en configuración sin crear ni repartir una ronda", () => {
  const presentations = [];
  const session = createSession({
    onChange: (presentation) => presentations.push(presentation),
  });

  session.start();

  assert.deepEqual(presentations.at(-1), {
    screen: LOCAL_GAME_SCREENS.CONFIGURATION,
    config: { K: 7, initialViewMode: BOARD_VIEW_MODES.TRADITIONAL },
    viewMode: BOARD_VIEW_MODES.TRADITIONAL,
    round: null,
  });
  assert.equal(session.getRoundState(), null);
});

for (const K of [0, 1, 7]) {
  test(`la pantalla inicial envía K=${K} al motor existente`, () => {
    const calls = [];
    const session = createSession({
      createRound: (options) => {
        calls.push(options);
        return createMatch(options);
      },
    });

    session.setK(K);
    session.startNewGame();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].K, K);
    assert.equal(
      session.getRoundState().config.specialMainLineDoublesLimit,
      K,
    );
    assert.deepEqual(
      Object.values(session.getRoundState().hands).map((hand) => hand.length),
      [7, 7, 7, 7],
    );
  });
}

test("la vista inicial puede ser Grafo, Puertos o Tradicional y cambia sin tocar K", () => {
  const graphSession = createSession({
    initialViewMode: BOARD_VIEW_MODES.GRAPH,
  });
  graphSession.startNewGame();
  assert.equal(graphSession.getPresentation().viewMode, BOARD_VIEW_MODES.GRAPH);

  const portSession = createSession({
    initialViewMode: BOARD_VIEW_MODES.PORTS,
  });
  portSession.startNewGame();
  assert.equal(portSession.getPresentation().viewMode, BOARD_VIEW_MODES.PORTS);

  const traditionalSession = createSession({
    initialK: 1,
    initialViewMode: BOARD_VIEW_MODES.TRADITIONAL,
  });
  traditionalSession.startNewGame();
  const before = structuredClone(traditionalSession.getRoundState());

  assert.equal(
    traditionalSession.getPresentation().viewMode,
    BOARD_VIEW_MODES.TRADITIONAL,
  );
  traditionalSession.setViewMode(BOARD_VIEW_MODES.PORTS);
  assert.equal(traditionalSession.getPresentation().viewMode, BOARD_VIEW_MODES.PORTS);
  traditionalSession.setViewMode(BOARD_VIEW_MODES.GRAPH);
  assert.equal(traditionalSession.getPresentation().viewMode, BOARD_VIEW_MODES.GRAPH);
  assert.equal(traditionalSession.getPresentation().config.K, 1);
  assert.deepEqual(traditionalSession.getRoundState(), before);
});

test("la barrera local oculta la mano entre turnos sin modificar el snapshot", () => {
  const session = createSession();
  session.startNewGame();
  const initial = structuredClone(session.getRoundState());
  let presentation = session.getPresentation();

  assert.equal(presentation.round.handPrivacy.isRevealed, false);
  assert.deepEqual(presentation.round.view.hand, []);
  assert.deepEqual(presentation.round.view.legalPlays, []);
  assert.equal(presentation.round.canPass, false);
  assert.throws(
    () => session.selectDomino(initial.hands[initial.currentPlayerId][0]),
    /Muestra la mano/,
  );

  session.revealCurrentHand();
  presentation = session.getPresentation();
  assert.equal(presentation.round.handPrivacy.isRevealed, true);
  assert.equal(presentation.round.view.hand.length, 7);
  assert.deepEqual(session.getRoundState(), initial);

  const action = getAvailableActions(initial)[0];
  session.selectDomino(action.dominoId);
  session.submitTarget(action.target);
  presentation = session.getPresentation();
  assert.equal(presentation.round.handPrivacy.isRevealed, false);
  assert.deepEqual(presentation.round.view.hand, []);
  assert.equal(presentation.round.selectedDominoId, null);
  assert.notEqual(session.getRoundState().currentPlayerId, initial.currentPlayerId);
});

test("cambiar Tradicional ↔ Puertos ↔ Grafo conserva privacidad y snapshot", () => {
  const session = createSession();
  session.startNewGame();
  const before = structuredClone(session.getRoundState());

  session.setViewMode(BOARD_VIEW_MODES.TRADITIONAL);
  session.setViewMode(BOARD_VIEW_MODES.PORTS);
  session.setViewMode(BOARD_VIEW_MODES.GRAPH);

  const presentation = session.getPresentation();
  assert.equal(presentation.round.handPrivacy.isRevealed, false);
  assert.deepEqual(presentation.round.view.hand, []);
  assert.deepEqual(presentation.round.portView.hand, []);
  assert.deepEqual(presentation.round.traditionalView.hand, []);
  assert.deepEqual(session.getRoundState(), before);
});

test("Jugar otra crea otra partida limpia, baraja de nuevo y conserva K/vista", () => {
  const randomSources = [() => 0.999999, () => 0];
  let randomSourceIndex = 0;
  const session = createSession({
    initialK: 1,
    randomSourceFactory: () => randomSources[randomSourceIndex++],
  });
  session.startNewGame();
  const firstInitialHands = structuredClone(session.getRoundState().hands);
  session.setViewMode(BOARD_VIEW_MODES.TRADITIONAL);
  const terminal = finishCurrentGame(session);
  const firstPlacementId = Object.keys(terminal.board.placements)[0];
  session.inspectPlacement(firstPlacementId);
  const terminalPresentation = session.getPresentation();

  assert.equal(terminal.phase, "finished");
  assert.notEqual(terminal.roundResult, undefined);
  assert.equal(terminalPresentation.round.handPrivacy.isRevealed, false);
  assert.deepEqual(terminalPresentation.round.view.hand, []);
  assert.deepEqual(terminalPresentation.round.traditionalView.hand, []);
  assert.equal(terminalPresentation.round.canPass, false);
  assert.notEqual(
    terminalPresentation.round.inspectedStructureId,
    null,
  );

  session.playAgain();
  const next = session.getRoundState();
  const presentation = session.getPresentation();

  assert.equal(randomSourceIndex, 2);
  assert.equal(presentation.config.K, 1);
  assert.equal(presentation.viewMode, BOARD_VIEW_MODES.TRADITIONAL);
  assert.equal(next.matchId, "local-game-2");
  assert.equal(next.phase, "playing");
  assert.equal(next.turnNumber, 1);
  assert.equal(next.consecutivePasses, 0);
  assert.deepEqual(next.board.mainLine.placementIds, []);
  assert.deepEqual(next.board.placements, {});
  assert.deepEqual(next.score.teams, { A: 0, B: 0 });
  assert.deepEqual(next.history, []);
  assert.equal("roundResult" in next, false);
  assert.deepEqual(
    Object.values(next.hands).map((hand) => hand.length),
    [7, 7, 7, 7],
  );
  assert.notDeepEqual(next.hands, firstInitialHands);
  assert.equal(presentation.round.selectedDominoId, null);
  assert.equal(presentation.round.inspectedPlacementId, null);
  assert.equal(presentation.round.inspectedStructureId, null);
  assert.equal(presentation.round.handPrivacy.isRevealed, false);
  assert.deepEqual(presentation.round.view.hand, []);
  assert.equal(presentation.round.canPass, false);
});

test("Cambiar configuración descarta el resultado y permite otro K y vista inicial", () => {
  const session = createSession({ initialK: 7 });
  session.startNewGame();
  finishCurrentGame(session);
  session.setViewMode(BOARD_VIEW_MODES.TRADITIONAL);

  session.changeConfiguration();
  assert.equal(session.getPresentation().screen, LOCAL_GAME_SCREENS.CONFIGURATION);
  assert.equal(session.getRoundState(), null);
  assert.deepEqual(session.getPresentation().config, {
    K: 7,
    initialViewMode: BOARD_VIEW_MODES.TRADITIONAL,
  });

  session.setK(0);
  session.setInitialViewMode(BOARD_VIEW_MODES.GRAPH);
  session.startNewGame();

  assert.equal(
    session.getRoundState().config.specialMainLineDoublesLimit,
    0,
  );
  assert.equal(session.getPresentation().viewMode, BOARD_VIEW_MODES.GRAPH);
  assert.equal("roundResult" in session.getRoundState(), false);
});

test("la UI expone configuración simple y acciones terminales sin divisor editable", async () => {
  const html = await readFile(
    new URL("../../index.html", import.meta.url),
    "utf8",
  );
  const source = await readFile(
    new URL("../../src/js/ui/LocalGameSessionController.js", import.meta.url),
    "utf8",
  );

  assert.match(html, /id="setup-screen"/);
  assert.match(html, /id="setup-k"/);
  assert.match(html, /value="0"/);
  assert.match(html, /value="7" selected/);
  assert.match(html, /name="initial-view-mode" value="graph">/);
  assert.match(html, /name="initial-view-mode" value="traditional" checked/);
  assert.match(html, /name="initial-view-mode" value="ports">/);
  assert.match(html, /data-view-mode="ports"/);
  assert.match(html, /Puntuación: múltiplos de 5/);
  assert.match(html, /id="play-again-action"/);
  assert.match(html, /id="change-config-action"/);
  assert.doesNotMatch(html, /name="(?:n|divisor)"/);
  assert.doesNotMatch(source, /GraphRenderer|TraditionalRenderer|state\.board/);
});
