import test from "node:test";

import {
  createMatch,
  ROUND_STRUCTURE_MODES,
  validateInitialMatchSnapshot,
} from "../../src/js/game/index.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

function validSnapshot() {
  return createMatch({
    ...createValidParticipantInput(),
    mode: ROUND_STRUCTURE_MODES.BRANCHED,
    randomSource: () => 0.4,
  });
}

function expectCorruption(code, mutate) {
  const snapshot = structuredClone(validSnapshot());
  mutate(snapshot);
  assertThrowsDomainCode(() => validateInitialMatchSnapshot(snapshot), code);
}

test("valida schemaVersion del snapshot inicial", () => {
  expectCorruption("INVALID_SCHEMA_VERSION", (snapshot) => {
    snapshot.schemaVersion = 2;
  });
});

test("valida phase=playing y turnNumber=1 del snapshot inicial", () => {
  expectCorruption("INVALID_INITIAL_PHASE", (snapshot) => {
    snapshot.phase = "setup";
  });
  expectCorruption("INVALID_INITIAL_PHASE", (snapshot) => {
    snapshot.turnNumber = 0;
  });
});

test("R-003: valida exactamente cuatro jugadores", () => {
  expectCorruption("INVALID_PLAYER_COUNT", (snapshot) => {
    delete snapshot.players.P4;
  });
});

test("R-003: valida exactamente dos equipos", () => {
  expectCorruption("INVALID_TEAM_COUNT", (snapshot) => {
    delete snapshot.teams.B;
  });
});

test("R-003: valida que las claves coincidan con IDs de jugadores y equipos", () => {
  expectCorruption("INVALID_PLAYER_MAP", (snapshot) => {
    snapshot.players.P1.id = "PX";
  });
  expectCorruption("INVALID_TEAM_MAP", (snapshot) => {
    snapshot.teams.A.id = "X";
  });
});

test("R-004: valida alternancia de compañeros", () => {
  expectCorruption("NON_ALTERNATING_TEAMS", (snapshot) => {
    snapshot.seating.counterclockwisePlayerIds = ["P1", "P3", "P2", "P4"];
  });
});

test("valida la codificación estructural interna", () => {
  expectCorruption("INVALID_INTERNAL_STRUCTURE_MODE", (snapshot) => {
    snapshot.config.specialMainLineDoublesLimit = -1;
  });
});

test("R-005: valida el catálogo de 28 fichas", () => {
  expectCorruption("INVALID_DOMINO_CATALOG", (snapshot) => {
    delete snapshot.dominoes["0-0"];
  });
  expectCorruption("INVALID_DOMINO_CATALOG", (snapshot) => {
    snapshot.dominoes["0-0"].isDouble = true;
  });
});

test("R-006: valida siete fichas por mano", () => {
  expectCorruption("INVALID_HAND_SIZE", (snapshot) => {
    snapshot.hands.P1.pop();
  });
});

test("R-006: valida ubicación única de las 28 fichas", () => {
  expectCorruption("INVALID_DOMINO_LOCATION", (snapshot) => {
    snapshot.hands.P2[0] = snapshot.hands.P1[0];
  });
});

test("valida tablero vacío al inicio", () => {
  expectCorruption("INITIAL_BOARD_NOT_EMPTY", (snapshot) => {
    snapshot.board.placements.p1 = { id: "p1", dominoId: "0-0" };
  });
  expectCorruption("INITIAL_BOARD_NOT_EMPTY", (snapshot) => {
    snapshot.board.specialDoublePlacementIds.push("p1");
  });
});

test("valida marcador inicial de ambos equipos", () => {
  expectCorruption("INVALID_INITIAL_SCORE", (snapshot) => {
    snapshot.score.teams.A = 1;
  });
});

test("valida contador inicial de pases", () => {
  expectCorruption("INVALID_INITIAL_PASSES", (snapshot) => {
    snapshot.consecutivePasses = 1;
  });
});

test("un snapshot inicial activo no admite roundResult", () => {
  expectCorruption("UNEXPECTED_ROUND_RESULT", (snapshot) => {
    snapshot.roundResult = { reason: "BLOCKED" };
  });
});

test("R-007: valida que currentPlayerId posea 6-6", () => {
  expectCorruption("INVALID_STARTING_PLAYER", (snapshot) => {
    snapshot.currentPlayerId =
      snapshot.currentPlayerId === "P1" ? "P2" : "P1";
  });
});

test("valida history vacío para una partida recién creada", () => {
  expectCorruption("INVALID_INITIAL_HISTORY", (snapshot) => {
    snapshot.history.push({ type: "TECHNICAL_SHUFFLE" });
  });
});
