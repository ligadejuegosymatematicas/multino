import test from "node:test";

import { validateBoardState } from "../../src/js/game/engine/BoardValidator.js";
import { getOpenEndTargets } from "../../src/js/game/engine/BoardQueries.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";
import {
  createBoardScenario,
  findDominoOwner,
  playDomino,
} from "../fixtures/board-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

function expectCorruption(state, code, mutate) {
  const corrupt = structuredClone(state);
  mutate(corrupt);
  assertThrowsDomainCode(() => validateBoardState(corrupt), code);
}

function removeFromHand(state, dominoId) {
  const ownerId = findDominoOwner(state, dominoId);
  state.hands[ownerId].splice(state.hands[ownerId].indexOf(dominoId), 1);
}

test("invariante: mainLine debe conservar un camino simple ordenado", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-5" });
  state = playDomino(state, "2-5");
  state = playDomino(state, "3-5", (target) => target.value === 5);
  state = playDomino(state, "0-2", (target) => target.value === 2);

  expectCorruption(state, "INVALID_MAIN_LINE_PATH", (snapshot) => {
    snapshot.board.mainLine.placementIds = [
      "placement-1",
      "placement-3",
      "placement-2",
    ];
  });
});

test("R-028: una conexión con valores distintos es inválida", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "2-5" });
  state = playDomino(state, "2-5");
  state = playDomino(state, "3-5", (target) => target.value === 5);

  expectCorruption(state, "INCOMPATIBLE_CONNECTION_VALUES", (snapshot) => {
    snapshot.board.connections["connection-1"].to.portId = "side:a";
  });
});

test("invariante: un puerto no puede estar ocupado dos veces", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "5-5" });
  state = playDomino(state, "5-5");
  state = playDomino(state, "2-5", targetAt("placement-1", "side:a"));
  state = playDomino(state, "3-5", targetAt("placement-1", "side:b"));

  expectCorruption(state, "PORT_ALREADY_CONNECTED", (snapshot) => {
    snapshot.board.connections["connection-2"].from.portId = "side:a";
  });
});

test("R-034: una rama no puede reconectarse a mainLine en un puerto ordinario", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "0-4", targetAt("placement-1", "main:1"));
  state = playDomino(state, "4-5", targetAt("placement-1", "main:2"));
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));

  expectCorruption(state, "BRANCH_RECONNECTS_MAIN_LINE", (snapshot) => {
    const ownerId = findDominoOwner(snapshot, "2-5");
    const index = snapshot.hands[ownerId].indexOf("2-5");
    snapshot.hands[ownerId][index] = "2-4";
    snapshot.board.placements["placement-4"].dominoId = "2-5";
    snapshot.history[3].payload.dominoId = "2-5";
    snapshot.board.connections["connection-3"].from = {
      placementId: "placement-3",
      portId: "side:b",
    };
    snapshot.board.connections["connection-3"].to.portId = "side:b";
  });
});

test("R-035: dos ramas distintas no pueden conectarse entre sí", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "0-4", targetAt("placement-1", "main:1"));
  state = playDomino(state, "1-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "3-4", targetAt("placement-1", "branch:2"));
  state = playDomino(state, "2-3", targetAt("placement-4", "side:a"));

  expectCorruption(state, "BRANCHES_CONNECTED", (snapshot) => {
    snapshot.board.connections["connection-6"] = {
      id: "connection-6",
      from: { placementId: "placement-6", portId: "side:b" },
      to: { placementId: "placement-5", portId: "side:a" },
    };
  });
});

test("R-002/R-035: una ramificación no puede originar otra ramificación", () => {
  let state = createBoardScenario({ K: 2, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "0-4", targetAt("placement-1", "main:1"));
  state = playDomino(state, "1-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "2-2", targetAt("placement-4", "side:a"));

  expectCorruption(state, "SECOND_LEVEL_BRANCH", (snapshot) => {
    removeFromHand(snapshot, "2-5");
    snapshot.board.placements["placement-6"] = {
      id: "placement-6",
      dominoId: "2-5",
    };
    snapshot.board.connections["connection-5"] = {
      id: "connection-5",
      from: { placementId: "placement-5", portId: "branch:1" },
      to: { placementId: "placement-6", portId: "side:a" },
    };
  });
});

test("R-002/R-032: un chancho ordinario no puede usar branch:*", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "2-4", targetAt("placement-1", "side:a"));

  expectCorruption(state, "ORDINARY_DOUBLE_BRANCH_PORT", (snapshot) => {
    snapshot.board.connections["connection-1"].from.portId = "branch:1";
  });
});

test("R-032: un chancho especial no puede exceder cuatro conexiones", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "0-4", targetAt("placement-1", "main:1"));
  state = playDomino(state, "1-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "3-4", targetAt("placement-1", "branch:2"));

  expectCorruption(state, "SPECIAL_DOUBLE_CONNECTION_LIMIT", (snapshot) => {
    removeFromHand(snapshot, "4-5");
    snapshot.board.placements["placement-6"] = {
      id: "placement-6",
      dominoId: "4-5",
    };
    snapshot.board.connections["connection-5"] = {
      id: "connection-5",
      from: { placementId: "placement-1", portId: "branch:1" },
      to: { placementId: "placement-6", portId: "side:a" },
    };
  });
});

test("R-032: un lateral exige ambas continuidades ocupadas", () => {
  let state = createBoardScenario({ firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "0-4", targetAt("placement-1", "main:1"));
  state = playDomino(state, "1-4", targetAt("placement-1", "main:2"));

  expectCorruption(state, "SPECIAL_DOUBLE_CONTINUITY_REQUIRED", (snapshot) => {
    snapshot.board.mainLine.placementIds = ["placement-1", "placement-3"];
    snapshot.board.connections["connection-1"].from.portId = "branch:1";
  });
});

test("invariante material: una ficha colocada no permanece en una mano", () => {
  let state = createBoardScenario({ firstDominoId: "2-5" });
  state = playDomino(state, "2-5");

  expectCorruption(state, "DOMINO_IN_MULTIPLE_LOCATIONS", (snapshot) => {
    snapshot.hands.P1.push("2-5");
  });
});

test("R-001: specialDoublePlacementIds no puede contener una ficha no doble", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "2-5" });
  state = playDomino(state, "2-5");

  expectCorruption(state, "INVALID_SPECIAL_DOUBLE", (snapshot) => {
    snapshot.board.specialDoublePlacementIds = ["placement-1"];
  });
});

test("R-001/R-027: no puede existir más de un chancho ramificador", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "3-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "3-3", targetAt("placement-2", "side:a"));

  expectCorruption(state, "SPECIAL_DOUBLE_LIMIT_EXCEEDED", (snapshot) => {
    snapshot.board.specialDoublePlacementIds.push("placement-3");
  });
});

test("consulta defensiva: un snapshot corrupto no expone destinos", () => {
  let state = createBoardScenario({ firstDominoId: "2-5" });
  state = playDomino(state, "2-5");
  state.board.mainLine.placementIds.push("placement-1");

  assertThrowsDomainCode(
    () => getOpenEndTargets(state),
    "INVALID_MAIN_LINE_PATH",
  );
});
