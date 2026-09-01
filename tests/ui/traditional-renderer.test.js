import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyTurnAction,
  createMatch,
  getLegalPlays,
  projectTraditionalView,
} from "../../src/js/game/index.js";
import {
  renderTraditionalTableMarkup,
} from "../../src/js/ui/TraditionalRenderer.js";
import { createTraditionalScene } from "../../src/js/ui/TraditionalScene.js";
import { InteractionController } from "../../src/js/ui/InteractionController.js";
import {
  BOARD_VIEW_MODES,
  ViewModeController,
} from "../../src/js/ui/ViewModeController.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";
import { createValidParticipantInput } from "../fixtures/participants.js";
import { createExitTurnState } from "../fixtures/turn-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

function createTraditionalScenario() {
  let state = createBoardScenario({ K: 2, firstDominoId: "4-4" });
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
  state = playDomino(
    state,
    "2-2",
    targetAt("placement-3", "side:a"),
  );
  return playDomino(
    state,
    "1-4",
    targetAt("placement-1", "branch:2"),
  );
}

function createDeterministicMatch() {
  return createMatch({
    ...createValidParticipantInput(),
    K: 7,
    randomSource: () => 0.999999,
  });
}

test("la escena ubica principal horizontal y ambos brazos verticales", () => {
  const scene = createTraditionalScene(
    projectTraditionalView(createTraditionalScenario()),
  );
  const family = scene.branchFamilies[0];

  assert.deepEqual(
    scene.mainTiles.map((tile) => tile.placementId),
    ["placement-1", "placement-2"],
  );
  assert.equal(scene.mainTiles[0].orientation, "vertical");
  assert.equal(scene.mainTiles[1].orientation, "horizontal");
  assert.equal(family.arms[0].direction, "up");
  assert.equal(family.arms[1].direction, "down");
  assert.ok(family.arms[0].tiles.every((tile) => tile.y < family.root.y));
  assert.ok(family.arms[1].tiles.every((tile) => tile.y > family.root.y));
  assert.equal(family.arms[0].tiles[1].orientation, "horizontal");
  assert.equal(family.arms[0].tiles[1].isSpecialDouble, false);
});

test("el markup muestra fichas, cruce especial y extremos abiertos exactos", () => {
  const scene = createTraditionalScene(
    projectTraditionalView(createTraditionalScenario()),
  );
  const markup = renderTraditionalTableMarkup(scene);

  assert.equal(
    markup.match(/class="traditional-domino /g)?.length,
    scene.tiles.length,
  );
  assert.equal(
    markup.match(/class="traditional-target /g)?.length,
    scene.openTargets.length,
  );
  assert.match(
    markup,
    /data-placement-id="placement-1"[^>]+data-special-double="true"/,
  );
  assert.match(markup, /traditional-domino__special[^>]*>×4</);
  assert.match(
    markup,
    /data-target-id="placement-4:side:b"[^>]+data-port-id="side:b"/,
  );
  assert.match(markup, /Especiales: 1\/2/);
});

test("un brazo iniciado y uno potencial se distinguen sin alterar sus puertos", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(
    state,
    "2-4",
    targetAt("placement-1", "branch:1"),
  );
  const scene = createTraditionalScene(projectTraditionalView(state));
  const markup = renderTraditionalTableMarkup(scene);
  const branchTargets = scene.openTargets.filter(
    (target) => target.topology.region === "branch",
  );

  assert.deepEqual(
    branchTargets.map((target) => ({
      portId: target.portId,
      branchState: target.topology.branchState,
      armIndex: target.topology.armIndex,
    })),
    [
      { portId: "side:a", branchState: "STARTED", armIndex: 1 },
      { portId: "branch:2", branchState: "POTENTIAL", armIndex: 2 },
    ],
  );
  assert.match(markup, /traditional-target is-neutral points-up is-branch is-started/);
  assert.match(markup, /traditional-target is-neutral points-down is-branch is-potential/);
});

test("la selección destaca solo extremos legales y conserva targets concretos", () => {
  const state = createTraditionalScenario();
  const playerId = state.currentPlayerId;
  const action = getLegalPlays(state, playerId)[0];
  const legalTargets = getLegalPlays(state, playerId)
    .filter((play) => play.dominoId === action.dominoId)
    .map((play) => ({
      ...play.target,
      id: play.target.kind === "OPEN_END"
        ? `${play.target.placementId}:${play.target.portId}`
        : undefined,
    }));
  const scene = createTraditionalScene(projectTraditionalView(state), {
    selectedDominoId: action.dominoId,
    legalTargets,
  });

  assert.equal(
    scene.openTargets.filter((target) => target.isLegal).length,
    legalTargets.length,
  );
  assert.equal(
    scene.openTargets.filter((target) => target.state === "incompatible").length,
    scene.openTargets.length - legalTargets.length,
  );
  assert.deepEqual(
    scene.openTargets.filter((target) => target.isLegal).map((target) => ({
      placementId: target.placementId,
      portId: target.portId,
    })),
    legalTargets.map((target) => ({
      placementId: target.placementId,
      portId: target.portId,
    })),
  );
});

test("un extremo tradicional envía al controlador placementId y portId exactos", () => {
  const actions = [];
  const controller = new InteractionController({
    initialState: createDeterministicMatch(),
    requestAction: (snapshot, action) => {
      actions.push(structuredClone(action));
      return applyTurnAction(snapshot, action);
    },
  });
  controller.selectDomino("6-6");
  controller.submitTarget({ kind: "START" });
  controller.selectDomino("4-6");
  const presentation = controller.getPresentation();
  const scene = createTraditionalScene(presentation.traditionalView, {
    selectedDominoId: presentation.selectedDominoId,
    legalTargets: presentation.selectedLegalTargets,
  });
  const chosen = scene.openTargets[2];

  controller.submitTarget(chosen);

  assert.deepEqual(actions.at(-1).target, {
    kind: "OPEN_END",
    placementId: chosen.placementId,
    portId: chosen.portId,
  });
});

test("START es una acción separada y no un extremo tradicional ficticio", () => {
  const state = createDeterministicMatch();
  const dominoId = state.hands[state.currentPlayerId][0];
  const scene = createTraditionalScene(projectTraditionalView(state), {
    selectedDominoId: dominoId,
    legalTargets: [{ kind: "START" }],
  });
  const markup = renderTraditionalTableMarkup(scene);

  assert.equal(scene.canStart, true);
  assert.deepEqual(scene.openTargets, []);
  assert.match(markup, /data-start-action/);
});

test("el conmutador cambia solo preferencia visual y conserva selección y snapshot", () => {
  const state = createDeterministicMatch();
  const before = structuredClone(state);
  const controller = new InteractionController({ initialState: state });
  controller.selectDomino("6-6");
  const modes = [];
  const switcher = new ViewModeController({
    onChange: (mode) => modes.push(mode),
  });

  switcher.setMode(BOARD_VIEW_MODES.TRADITIONAL);
  switcher.setMode(BOARD_VIEW_MODES.GRAPH);

  assert.deepEqual(modes, ["traditional", "graph"]);
  assert.equal(controller.getPresentation().selectedDominoId, "6-6");
  assert.deepEqual(controller.getState(), before);
  assert.deepEqual(state, before);
});

test("una ronda terminada mantiene la mesa y deshabilita sus extremos", () => {
  const state = createExitTurnState();
  const terminal = applyTurnAction(
    state,
    getLegalPlays(state, state.currentPlayerId)[0],
  );
  const scene = createTraditionalScene(projectTraditionalView(terminal));
  const markup = renderTraditionalTableMarkup(scene);

  assert.equal(scene.isFinished, true);
  assert.ok(scene.tiles.length > 0);
  assert.ok(scene.openTargets.every((target) => target.isDisabled));
  assert.equal(
    markup.match(/class="traditional-target [^"]+"[^>]+ disabled/g)?.length,
    scene.openTargets.length,
  );
});

test("renderer, responsive y accesibilidad no dependen del board ni de overflow global", async () => {
  const rendererSource = await readFile(
    new URL("../../src/js/ui/TraditionalRenderer.js", import.meta.url),
    "utf8",
  );
  const sceneSource = await readFile(
    new URL("../../src/js/ui/TraditionalScene.js", import.meta.url),
    "utf8",
  );
  const css = await readFile(
    new URL("../../src/css/traditional.css", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(rendererSource, /\bstate\.board\b|\bview\.board\b/);
  assert.doesNotMatch(sceneSource, /\bstate\.board\b|\bview\.board\b/);
  assert.match(rendererSource, /aria-label="Mesa tradicional de dominó"/);
  assert.match(css, /\.traditional-table \{[\s\S]+?overflow:\s*auto/);
  assert.match(css, /touch-action:\s*pan-x pan-y/);
  assert.match(css, /@media \(max-width: 36rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
