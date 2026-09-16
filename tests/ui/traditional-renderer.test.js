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
import {
  calculateTraditionalFitScale,
  createTraditionalScene,
  TRADITIONAL_CONNECTION_CLEARANCE,
  TRADITIONAL_FINAL_MIN_SCALE,
  TRADITIONAL_MIN_READABLE_SCALE,
  TRADITIONAL_TARGET_CENTER_DISTANCE,
  TRADITIONAL_TARGET_HIT_SIZE,
} from "../../src/js/ui/TraditionalScene.js";
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

function pointOutsideFace(tile, side, distance) {
  switch (side) {
    case "left":
      return { x: tile.x - tile.width / 2 - distance, y: tile.y };
    case "right":
      return { x: tile.x + tile.width / 2 + distance, y: tile.y };
    case "top":
      return { x: tile.x, y: tile.y - tile.height / 2 - distance };
    case "bottom":
      return { x: tile.x, y: tile.y + tile.height / 2 + distance };
    default:
      throw new Error(`Cara inesperada: ${side}`);
  }
}

function rectanglesOverlap(first, second) {
  return first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top;
}

function tileBounds(tile) {
  return {
    left: tile.x - tile.width / 2,
    right: tile.x + tile.width / 2,
    top: tile.y - tile.height / 2,
    bottom: tile.y + tile.height / 2,
  };
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

function createOrientationScenario() {
  let state = createBoardScenario({ K: 2, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "3-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "3-3", targetAt("placement-2", "side:a"));
  state = playDomino(state, "4-6", targetAt("placement-1", "main:1"));
  state = playDomino(state, "5-6", targetAt("placement-4", "side:b"));
  state = playDomino(state, "1-4", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "1-1", targetAt("placement-6", "side:a"));
  state = playDomino(state, "0-1", targetAt("placement-7", "side:b"));
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:2"));
  return playDomino(state, "2-5", targetAt("placement-9", "side:a"));
}

function createDeterministicMatch() {
  return createMatch({
    ...createValidParticipantInput(),
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

test("cada unión física enfrenta el valor exacto de su conexión lógica", () => {
  const scene = createTraditionalScene(
    projectTraditionalView(createOrientationScenario()),
  );

  assert.ok(scene.connections.length >= 9);
  const tiles = new Map(scene.tiles.map((tile) => [tile.placementId, tile]));
  for (const connection of scene.connections) {
    assert.equal(connection.firstFace.value, connection.value);
    assert.equal(connection.secondFace.value, connection.value);
    assert.deepEqual(
      { x: connection.x1, y: connection.y1 },
      pointOutsideFace(
        tiles.get(connection.firstPlacementId),
        connection.firstFace.side,
        TRADITIONAL_CONNECTION_CLEARANCE,
      ),
    );
    assert.deepEqual(
      { x: connection.x2, y: connection.y2 },
      pointOutsideFace(
        tiles.get(connection.secondPlacementId),
        connection.secondFace.side,
        TRADITIONAL_CONNECTION_CLEARANCE,
      ),
    );
  }

  const connections = new Map(
    scene.connections.map((connection) => [connection.id, connection]),
  );
  for (const id of ["connection-1", "connection-2", "connection-3", "connection-4"]) {
    assert.equal(connections.get(id).firstFace.side, "right");
    assert.equal(connections.get(id).secondFace.side, "left");
  }
  for (const id of ["connection-5", "connection-6", "connection-7"]) {
    assert.equal(connections.get(id).firstFace.side, "top");
    assert.equal(connections.get(id).secondFace.side, "bottom");
  }
  for (const id of ["connection-8", "connection-9"]) {
    assert.equal(connections.get(id).firstFace.side, "bottom");
    assert.equal(connections.get(id).secondFace.side, "top");
  }
});

test("conectores, hit areas y puentes quedan fuera del interior de las fichas", () => {
  const scene = createTraditionalScene(
    projectTraditionalView(createOrientationScenario()),
  );
  const tiles = new Map(scene.tiles.map((tile) => [tile.placementId, tile]));
  const strokeHalf = 2;

  for (const connection of scene.connections) {
    const bounds = connection.orientation === "horizontal"
      ? {
          left: Math.min(connection.x1, connection.x2),
          right: Math.max(connection.x1, connection.x2),
          top: connection.y1 - strokeHalf,
          bottom: connection.y1 + strokeHalf,
        }
      : {
          left: connection.x1 - strokeHalf,
          right: connection.x1 + strokeHalf,
          top: Math.min(connection.y1, connection.y2),
          bottom: Math.max(connection.y1, connection.y2),
        };
    for (const placementId of [
      connection.firstPlacementId,
      connection.secondPlacementId,
    ]) {
      assert.equal(
        rectanglesOverlap(bounds, tileBounds(tiles.get(placementId))),
        false,
        `${connection.id} invade ${placementId}`,
      );
    }
  }

  const hitHalf = TRADITIONAL_TARGET_HIT_SIZE / 2;
  assert.ok(TRADITIONAL_TARGET_CENTER_DISTANCE > hitHalf);
  for (const target of scene.openTargets) {
    const hitBounds = {
      left: target.x - hitHalf,
      right: target.x + hitHalf,
      top: target.y - hitHalf,
      bottom: target.y + hitHalf,
    };
    assert.equal(
      rectanglesOverlap(hitBounds, tileBounds(tiles.get(target.placementId))),
      false,
      `${target.id} invade su ficha de anclaje`,
    );
  }
});

test("orienta fichas asimétricas hacia ambos extremos y ambos brazos", () => {
  const scene = createTraditionalScene(
    projectTraditionalView(createOrientationScenario()),
  );
  const tiles = new Map(scene.tiles.map((tile) => [tile.placementId, tile]));

  assert.deepEqual(
    ["placement-5", "placement-4", "placement-2"].map((id) => ({
      id,
      first: tiles.get(id).firstValue,
      second: tiles.get(id).secondValue,
    })),
    [
      { id: "placement-5", first: 5, second: 6 },
      { id: "placement-4", first: 6, second: 4 },
      { id: "placement-2", first: 4, second: 3 },
    ],
  );
  assert.deepEqual(
    ["placement-6", "placement-8", "placement-9", "placement-10"].map(
      (id) => ({
        id,
        first: tiles.get(id).firstValue,
        second: tiles.get(id).secondValue,
      }),
    ),
    [
      { id: "placement-6", first: 1, second: 4 },
      { id: "placement-8", first: 0, second: 1 },
      { id: "placement-9", first: 4, second: 2 },
      { id: "placement-10", first: 2, second: 5 },
    ],
  );
  assert.equal(tiles.get("placement-7").isDouble, true);
  assert.equal(tiles.get("placement-7").isSpecialDouble, false);
  assert.equal(tiles.get("placement-1").isSpecialDouble, true);
  assert.equal(tiles.get("placement-3").isSpecialDouble, false);
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
  assert.match(markup, /traditional-domino__special[^>]*><\/span>/);
  assert.match(
    markup,
    /data-target-id="placement-4:side:b"[^>]+data-port-id="side:b"/,
  );
  assert.doesNotMatch(markup, /Especiales:|>×4<|<small>|family-tone-/);
  assert.match(markup, /data-fit-table/);
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
  assert.doesNotMatch(
    renderTraditionalTableMarkup(scene),
    />\s*S\s*=|>\s*\+\d+\s+puntos|>\s*no puntúa/i,
  );
});

test("los números de opción aparecen solo para targets compatibles repetidos", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const view = projectTraditionalView(state);
  const neutral = createTraditionalScene(view);
  const legalTargets = view.table.openTargets.map((target) => ({ ...target }));
  const selected = createTraditionalScene(view, {
    selectedDominoId: "0-4",
    legalTargets,
  });

  assert.ok(neutral.openTargets.every((target) => target.optionIndex === null));
  assert.deepEqual(
    selected.openTargets.map((target) => target.optionIndex),
    [1, 2, 3, 4],
  );
  assert.match(selected.openTargets[0].accessibleLabel, /opción 1 de 4/);
  assert.doesNotMatch(
    renderTraditionalTableMarkup(neutral),
    /traditional-target__option/,
  );
  assert.equal(
    renderTraditionalTableMarkup(selected).match(
      /traditional-target__option/g,
    )?.length,
    4,
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

  assert.equal(switcher.getMode(), BOARD_VIEW_MODES.TRADITIONAL);
  switcher.setMode(BOARD_VIEW_MODES.GRAPH);
  switcher.setMode(BOARD_VIEW_MODES.TRADITIONAL);

  assert.deepEqual(modes, ["graph", "traditional"]);
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
  const view = projectTraditionalView(terminal);
  const scene = createTraditionalScene(view, {
    scoringResolution: view.scoringPresentation.latestResolution,
  });
  const markup = renderTraditionalTableMarkup(scene);

  assert.equal(scene.isFinished, true);
  assert.ok(scene.tiles.length > 0);
  assert.ok(scene.openTargets.every((target) => target.isDisabled));
  assert.equal(
    markup.match(/class="traditional-target [^"]+"[^>]+ disabled/g)?.length,
    scene.openTargets.length,
  );
  assert.match(markup, />Ver mesa completa<\/button>/);
  assert.ok(scene.tiles.some((tile) => tile.isScoringTerm));
  assert.match(markup, /traditional-domino [^"]*is-scoring-term/);
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
  assert.match(css, /\.traditional-table__viewport \{[\s\S]+?overflow:\s*auto/);
  assert.match(css, /touch-action:\s*pan-x pan-y/);
  assert.match(rendererSource, /data-fit-table/);
  assert.match(rendererSource, /pointermove/);
  assert.match(css, /@media \(max-width: 36rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("la cámara amplía estados holgados sin reducir fichas bajo el mínimo legible", () => {
  assert.equal(
    calculateTraditionalFitScale({
      contentWidth: 720,
      contentHeight: 430,
      viewportWidth: 1000,
      viewportHeight: 650,
    }),
    1.339,
  );
  assert.equal(
    calculateTraditionalFitScale({
      contentWidth: 720,
      contentHeight: 430,
      viewportWidth: 360,
      viewportHeight: 430,
    }),
    TRADITIONAL_MIN_READABLE_SCALE,
  );
  assert.equal(
    calculateTraditionalFitScale({
      contentWidth: 1600,
      contentHeight: 900,
      viewportWidth: 390,
      viewportHeight: 430,
    }),
    TRADITIONAL_MIN_READABLE_SCALE,
  );
  const finalFit = calculateTraditionalFitScale({
    contentWidth: 1600,
    contentHeight: 900,
    viewportWidth: 390,
    viewportHeight: 430,
    minScale: TRADITIONAL_FINAL_MIN_SCALE,
  });
  assert.equal(finalFit, 0.221);
  assert.ok(finalFit < TRADITIONAL_MIN_READABLE_SCALE);
  assert.ok(finalFit >= TRADITIONAL_FINAL_MIN_SCALE);
});
