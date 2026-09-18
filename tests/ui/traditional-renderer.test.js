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
  createTraditionalFitCamera,
  isTraditionalOrientationChange,
  preserveTraditionalCamera,
  revealTraditionalWorldBounds,
} from "../../src/js/ui/TraditionalCamera.js";
import {
  calculateTraditionalFitScale,
  createTraditionalScene,
  TRADITIONAL_CONNECTION_CLEARANCE,
  TRADITIONAL_FINAL_MIN_SCALE,
  TRADITIONAL_MIN_READABLE_SCALE,
  TRADITIONAL_TARGET_CENTER_DISTANCE,
  TRADITIONAL_TARGET_HIT_SIZE,
} from "../../src/js/ui/TraditionalScene.js";
import {
  TRADITIONAL_COLLISION_MARGIN,
  traditionalBoundsOverlap,
  traditionalTileBounds,
} from "../../src/js/ui/TraditionalSnakeLayout.js";
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
    "0-4",
    targetAt("placement-1", "main:1"),
  );
  state = playDomino(
    state,
    "2-4",
    targetAt("placement-1", "branch:1"),
  );
  state = playDomino(
    state,
    "2-2",
    targetAt("placement-4", "side:a"),
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

function createLongLinearScenario() {
  let state = createBoardScenario({ K: 0, firstDominoId: "6-6" });
  for (const dominoId of [
    "6-6",
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
  return state;
}

function createLongLinearStates() {
  let state = createBoardScenario({ K: 0, firstDominoId: "6-6" });
  const states = [];
  for (const dominoId of [
    "6-6",
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
    states.push(state);
  }
  return states;
}

function createRamifiedGrowthStates() {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  const states = [];
  const play = (dominoId, predicate) => {
    state = playDomino(state, dominoId, predicate);
    states.push(state);
  };
  play("4-4");
  play("3-4", targetAt("placement-1", "main:2"));
  play("4-6", targetAt("placement-1", "main:1"));
  play("1-4", targetAt("placement-1", "branch:1"));
  play("2-4", targetAt("placement-1", "branch:2"));
  play("5-6", targetAt("placement-3", "side:b"));
  play("0-3", targetAt("placement-2", "side:a"));
  play("1-1", targetAt("placement-4", "side:a"));
  play("2-2", targetAt("placement-5", "side:a"));
  return states;
}

function geometryByPlacement(scene) {
  return new Map(scene.tiles.map((tile) => [tile.placementId, {
    x: tile.x,
    y: tile.y,
    direction: tile.direction,
    orientation: tile.orientation,
    firstValue: tile.firstValue,
    secondValue: tile.secondValue,
  }]));
}

function assertPreviousGeometryFrozen(previous, next) {
  const before = geometryByPlacement(previous);
  const after = geometryByPlacement(next);
  for (const [placementId, geometry] of before) {
    assert.deepEqual(
      after.get(placementId),
      geometry,
      `${placementId} cambió de posición u orientación`,
    );
  }
}

function createIncrementalScenes(states) {
  const scenes = [];
  let previousLayout = null;
  for (const state of states) {
    const scene = createTraditionalScene(projectTraditionalView(state), {
      previousLayout,
    });
    previousLayout = scene.layoutState;
    scenes.push(scene);
  }
  return scenes;
}

test("la escena ubica principal horizontal y ambos brazos verticales", () => {
  const scene = createTraditionalScene(
    projectTraditionalView(createTraditionalScenario()),
  );
  const family = scene.branchFamilies[0];

  assert.deepEqual(
    scene.mainTiles.map((tile) => tile.placementId),
    ["placement-3", "placement-1", "placement-2"],
  );
  assert.equal(scene.mainTiles.find((tile) => tile.placementId === "placement-1").orientation, "vertical");
  assert.ok(
    scene.mainTiles
      .filter((tile) => tile.placementId !== "placement-1")
      .every((tile) => tile.orientation === "horizontal"),
  );
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

  assert.ok(scene.connections.every((connection) =>
    connection.segments.length === 1 || connection.segments.length === 2
  ));
  assert.ok(scene.connections.flatMap((connection) => connection.segments)
    .every((segment) =>
      segment.orientation === "horizontal" || segment.orientation === "vertical"
    ));
});

test("Lineal serpentea antes del borde y conserva fichas legibles", () => {
  const scene = createTraditionalScene(
    projectTraditionalView(createLongLinearScenario()),
  );
  const directions = scene.mainTiles.map((tile) => tile.direction);

  assert.equal(scene.layoutStats.strategy, "linear-snake");
  assert.ok(scene.layoutStats.turnCount >= 2);
  assert.ok(new Set(directions).size >= 3);
  assert.ok(scene.tiles.every((tile) =>
    Math.max(tile.width, tile.height) === 72 &&
    Math.min(tile.width, tile.height) === 38
  ));
  assert.ok(scene.width < scene.tiles.length * 72);
});

test("Lineal agrega una ficha sin recolocar el snake ya jugado", () => {
  const scenes = createIncrementalScenes(createLongLinearStates());

  scenes.slice(1).forEach((scene, index) => {
    assertPreviousGeometryFrozen(scenes[index], scene);
    assert.equal(scene.tiles.length, scenes[index].tiles.length + 1);
    assert.ok(scene.width >= scenes[index].width);
    assert.ok(scene.height >= scenes[index].height);
  });
  assert.ok(scenes.at(-1).layoutStats.turnCount >= 2);
  assert.ok(new Set(scenes.at(-1).mainTiles.map((tile) => tile.direction)).size >= 3);
});

test("Ramificado congela 2, 3 y 4 brazos mientras crecen por separado", () => {
  const scenes = createIncrementalScenes(createRamifiedGrowthStates());

  scenes.slice(1).forEach((scene, index) =>
    assertPreviousGeometryFrozen(scenes[index], scene)
  );
  const finalScene = scenes.at(-1);
  const root = finalScene.tiles.find((tile) => tile.isSpecialDouble);
  const rootIndex = finalScene.mainTiles.findIndex(
    (tile) => tile.placementId === root.placementId,
  );
  const outward = new Set([
    finalScene.mainTiles[rootIndex - 1]?.direction,
    finalScene.mainTiles[rootIndex + 1]?.direction,
    ...finalScene.branchFamilies[0].arms
      .filter((arm) => arm.tiles.length > 0)
      .map((arm) => arm.tiles[0].direction),
  ].filter(Boolean));
  assert.deepEqual(outward, new Set(["left", "right", "up", "down"]));
});

test("el crecimiento incremental conserva margen al borde y ante colisiones", () => {
  const scenes = createIncrementalScenes(createLongLinearStates());
  const margin = TRADITIONAL_COLLISION_MARGIN / 2;

  for (const scene of scenes) {
    const connectedPairs = new Set(scene.connections.map((connection) =>
      [connection.firstPlacementId, connection.secondPlacementId]
        .sort()
        .join(":"),
    ));
    scene.tiles.forEach((first, index) => {
      scene.tiles.slice(index + 1).forEach((second) => {
        const pair = [first.placementId, second.placementId]
          .sort()
          .join(":");
        if (connectedPairs.has(pair)) return;
        assert.equal(
          traditionalBoundsOverlap(
            traditionalTileBounds(first, margin),
            traditionalTileBounds(second, margin),
          ),
          false,
          `${pair} colisionan`,
        );
      });
    });
  }
});

test("el layout evita colisiones ambiguas entre fichas no conectadas", () => {
  const scene = createTraditionalScene(
    projectTraditionalView(createOrientationScenario()),
  );
  const connectedPairs = new Set(scene.connections.map((connection) =>
    [connection.firstPlacementId, connection.secondPlacementId].sort().join(":"),
  ));
  const margin = TRADITIONAL_COLLISION_MARGIN / 2;

  scene.tiles.forEach((first, firstIndex) => {
    scene.tiles.slice(firstIndex + 1).forEach((second) => {
      const pair = [first.placementId, second.placementId].sort().join(":");
      if (connectedPairs.has(pair)) return;
      assert.equal(
        traditionalBoundsOverlap(
          traditionalTileBounds(first, margin),
          traditionalTileBounds(second, margin),
        ),
        false,
        `${pair} queda demasiado cerca`,
      );
    });
  });
});

test("Ramificado dispone cuatro brazos alrededor del único chancho", () => {
  const scene = createTraditionalScene(
    projectTraditionalView(createOrientationScenario()),
  );
  const root = scene.tiles.find((tile) => tile.isSpecialDouble);
  const outwardDirections = new Set([
    scene.mainTiles[scene.mainTiles.indexOf(root) - 1]?.direction,
    scene.mainTiles[scene.mainTiles.indexOf(root) + 1]?.direction,
    ...scene.branchFamilies[0].arms
      .filter((arm) => arm.tiles.length > 0)
      .map((arm) => arm.tiles[0].direction),
  ].filter(Boolean));

  assert.equal(scene.layoutStats.strategy, "four-arm-snake");
  assert.deepEqual(outwardDirections, new Set(["left", "right", "up", "down"]));
  assert.equal(scene.branchFamilies[0].arms.length, 2);
});

test("conectores, hit areas y puentes quedan fuera del interior de las fichas", () => {
  const scene = createTraditionalScene(
    projectTraditionalView(createOrientationScenario()),
  );
  const tiles = new Map(scene.tiles.map((tile) => [tile.placementId, tile]));
  const strokeHalf = 2;

  for (const connection of scene.connections) {
    for (const segment of connection.segments) {
      const bounds = segment.orientation === "horizontal"
        ? {
            left: Math.min(segment.x, segment.x2),
            right: Math.max(segment.x, segment.x2),
            top: segment.y - strokeHalf,
            bottom: segment.y + strokeHalf,
          }
        : {
            left: segment.x - strokeHalf,
            right: segment.x + strokeHalf,
            top: Math.min(segment.y, segment.y2),
            bottom: Math.max(segment.y, segment.y2),
          };
      for (const tile of tiles.values()) {
        assert.equal(
          rectanglesOverlap(bounds, tileBounds(tile)),
          false,
          `${segment.id} invade ${tile.placementId}`,
        );
      }
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
      { id: "placement-8", first: 1, second: 0 },
      { id: "placement-9", first: 4, second: 2 },
      { id: "placement-10", first: 5, second: 2 },
    ],
  );
  assert.equal(tiles.get("placement-8").direction, "right");
  assert.equal(tiles.get("placement-10").direction, "left");
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
    /data-target-id="placement-6:side:a"[^>]+data-port-id="side:a"/,
  );
  assert.doesNotMatch(markup, /Especiales:|>×4<|<small>|family-tone-/);
  assert.match(markup, /data-fit-table/);
});

test("un brazo iniciado y uno potencial se distinguen sin alterar sus puertos", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "0-4", targetAt("placement-1", "main:1"));
  state = playDomino(state, "1-4", targetAt("placement-1", "main:2"));
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

test("los laterales del ramificador permanecen visibles y bloqueados hasta completar el cruce", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const emptyCross = createTraditionalScene(projectTraditionalView(state));
  state = playDomino(state, "0-4", targetAt("placement-1", "main:1"));
  const halfCross = createTraditionalScene(projectTraditionalView(state));
  state = playDomino(state, "1-4", targetAt("placement-1", "main:2"));
  const completeCross = createTraditionalScene(projectTraditionalView(state));

  assert.equal(emptyCross.lockedRamifierSockets.length, 2);
  assert.equal(halfCross.lockedRamifierSockets.length, 2);
  assert.equal(
    halfCross.openTargets.filter(
      (target) => target.placementId === "placement-1",
    ).length,
    1,
  );
  assert.equal(completeCross.lockedRamifierSockets.length, 0);
  assert.deepEqual(
    completeCross.openTargets
      .filter((target) => target.placementId === "placement-1")
      .map((target) => target.portId),
    ["branch:1", "branch:2"],
  );
  const lockedMarkup = renderTraditionalTableMarkup(halfCross);
  assert.equal(
    lockedMarkup.match(/traditional-ramifier-socket is-locked/g)?.length,
    2,
  );
  assert.doesNotMatch(
    lockedMarkup,
    /data-target-id="placement-1:branch:/,
  );
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
    [1, 2],
  );
  assert.match(selected.openTargets[0].accessibleLabel, /opción 1 de 2/);
  assert.doesNotMatch(
    renderTraditionalTableMarkup(neutral),
    /traditional-target__option/,
  );
  assert.equal(
    renderTraditionalTableMarkup(selected).match(
      /traditional-target__option/g,
    )?.length,
    2,
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
  const chosen = scene.openTargets[1];

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
  assert.match(markup, />Centrar mesa<\/button>/);
  const sourceCount = scene.tiles.filter((tile) => tile.isScoringTerm).length +
    scene.openTargets.filter((target) => target.isScoringTerm).length;
  const expectedSourceCount = view.scoringPresentation.latestResolution.terms
    .filter((term) => term.isDouble ? term.factor > 0 : true).length;
  assert.equal(sourceCount, expectedSourceCount);
  assert.match(markup, /traditional-(?:domino|target) [^"]*is-scoring-term/);
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
  assert.doesNotMatch(rendererSource, /scene\.isFinished\s*\|\|\s*this\.sceneSignature/);
  assert.match(rendererSource, /revealTraditionalWorldBounds/);
  assert.match(rendererSource, /isTraditionalOrientationChange/);
  assert.match(css, /@media \(max-width: 36rem\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("la cámara conserva zoom y pan salvo el mínimo necesario para revelar la nueva ficha", () => {
  const initial = createTraditionalFitCamera({
    scale: 1,
    contentBounds: {
      centerX: 250,
      centerY: 180,
    },
    tableWidth: 1000,
    tableHeight: 800,
    viewportWidth: 400,
    viewportHeight: 300,
  });
  const preserved = preserveTraditionalCamera(initial, {
    tableWidth: 1000,
    tableHeight: 800,
    viewportWidth: 360,
    viewportHeight: 280,
  });
  const alreadyVisible = revealTraditionalWorldBounds(
    preserved,
    { left: 180, right: 220, top: 140, bottom: 180 },
    {
      tableWidth: 1000,
      tableHeight: 800,
      viewportWidth: 360,
      viewportHeight: 280,
    },
  );
  const revealed = revealTraditionalWorldBounds(
    preserved,
    { left: 620, right: 692, top: 140, bottom: 178 },
    {
      tableWidth: 1000,
      tableHeight: 800,
      viewportWidth: 360,
      viewportHeight: 280,
    },
  );

  assert.equal(preserved.scale, initial.scale);
  assert.equal(alreadyVisible.scale, initial.scale);
  assert.equal(alreadyVisible.left, preserved.left);
  assert.equal(alreadyVisible.top, preserved.top);
  assert.equal(revealed.scale, initial.scale);
  assert.ok(revealed.left > preserved.left);
  assert.equal(revealed.top, preserved.top);
});

test("solo un cambio real de orientación autoriza el fit automático", () => {
  assert.equal(
    isTraditionalOrientationChange(
      { width: 700, height: 500 },
      { width: 620, height: 500 },
    ),
    false,
  );
  assert.equal(
    isTraditionalOrientationChange(
      { width: 700, height: 500 },
      { width: 390, height: 700 },
    ),
    true,
  );
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
  assert.equal(finalFit, TRADITIONAL_FINAL_MIN_SCALE);
  assert.ok(finalFit < TRADITIONAL_MIN_READABLE_SCALE);
  assert.ok(finalFit >= 0.5);
});
