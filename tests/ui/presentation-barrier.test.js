import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getLocalCpuPresentationDelay,
  getOnlineIdleTurnMessage,
  getPresentedActivePlayerId,
  isPresentationBarrierActive,
  resolvePresentedFeedback,
} from "../../src/js/ui/PresentationBarrier.js";

test("Realtime no reemplaza un scoring que sigue presentado", () => {
  const active = { sequence: 17, scoring: { sum: 10 }, message: "+2" };
  const newerSnapshotFeedback = {
    sequence: 18,
    scoring: { sum: 7 },
    message: "Sin puntos",
  };

  assert.equal(resolvePresentedFeedback({
    nextFeedback: newerSnapshotFeedback,
    lastFeedbackSequence: null,
    activeFeedback: active,
  }), active);
});

test("la barrera bloquea interacción por scoring, backlog o terminalidad diferida", () => {
  assert.equal(isPresentationBarrierActive({
    feedback: { scoring: { sum: 5 } },
  }), true);
  assert.equal(isPresentationBarrierActive({
    presentationQueue: { isBusy: true },
  }), true);
  assert.equal(isPresentationBarrierActive({ roundResultPending: true }), true);
  assert.equal(isPresentationBarrierActive({
    feedback: null,
    presentationQueue: { isBusy: false },
  }), false);
});

test("la CPU local espera el scoring, pero PASS conserva un settle corto", () => {
  const scoringDurationMs = 9000;
  assert.equal(getLocalCpuPresentationDelay({
    state: { history: [] },
    scoringDurationMs,
  }), 650);
  assert.equal(getLocalCpuPresentationDelay({
    state: { history: [{ type: "PLAY_DOMINO" }] },
    scoringDurationMs,
  }), 9550);
  assert.equal(getLocalCpuPresentationDelay({
    state: { history: [{ type: "PASS" }] },
    scoringDurationMs,
  }), 850);
});

test("al vaciar la cola, el mensaje cambia del actor presentado al turno autoritativo", () => {
  const players = [
    { playerId: "seat-3", displayName: "Catalina" },
    { playerId: "seat-4", displayName: "CPU 4" },
  ];
  const seats = [
    { seatId: "seat-3", nick: "Catalina", controlType: "HUMAN" },
    { seatId: "seat-4", nick: "CPU 4", controlType: "CPU" },
  ];
  assert.equal(getOnlineIdleTurnMessage({
    currentPlayerId: "seat-3",
    players,
    seats,
  }), "Turno de Catalina");
  assert.equal(getOnlineIdleTurnMessage({
    currentPlayerId: "seat-4",
    players,
    seats,
  }), "CPU 4 está jugando…");
  assert.equal(getOnlineIdleTurnMessage({
    isFinished: true,
    currentPlayerId: "seat-4",
    players,
    seats,
  }), "");
});

test("el actor terminal solo permanece activo durante la presentacion final", () => {
  assert.equal(getPresentedActivePlayerId({
    isFinished: false,
    currentPlayerId: "seat-2",
  }), "seat-2");
  assert.equal(getPresentedActivePlayerId({
    isFinished: true,
    roundResultDeferred: true,
    feedbackPlayerId: "seat-2",
    currentPlayerId: "seat-2",
  }), "seat-2");
  assert.equal(getPresentedActivePlayerId({
    isFinished: true,
    roundResultDeferred: false,
    feedbackPlayerId: "seat-2",
    presentationActorId: "seat-2",
    currentPlayerId: "seat-2",
  }), null);
});

test("la UI no permite saltar scoring, revelar mano ni cambiar vista", async () => {
  const main = await readFile(new URL("../../src/js/main.js", import.meta.url), "utf8");
  const feedback = await readFile(
    new URL("../../src/js/ui/GameFeedback.js", import.meta.url),
    "utf8",
  );
  const hand = await readFile(
    new URL("../../src/js/ui/HandRenderer.js", import.meta.url),
    "utf8",
  );
  const turn = await readFile(
    new URL("../../src/js/ui/TurnIndicator.js", import.meta.url),
    "utf8",
  );

  assert.match(main, /activeFeedbackPresentation/);
  assert.match(main, /revealHandButton\.hidden = !canReveal/);
  assert.match(main, /button\.disabled = interactionLocked/);
  assert.match(main, /aria-disabled", String\(interactionLocked\)/);
  assert.match(main, /disabled: interactionLocked/);
  assert.doesNotMatch(main, /completeScoringFeedback/);
  assert.doesNotMatch(feedback, /Toca para completar|role", "button"/);
  assert.match(hand, /presentation\.isFinished \|\| disabled/);
  assert.match(main, /getPresentedActivePlayerId\(\{/);
  assert.match(turn, /player\.playerId === activePlayerId/);
});
