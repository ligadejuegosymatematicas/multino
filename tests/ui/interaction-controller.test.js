import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTurnAction,
  createMatch,
  getLegalPlays,
} from "../../src/js/game/index.js";
import { InteractionController } from "../../src/js/ui/InteractionController.js";
import { createValidParticipantInput } from "../fixtures/participants.js";
import {
  createBlockedTurnState,
  createExitTurnState,
} from "../fixtures/turn-scenarios.js";

function createDeterministicMatch() {
  return createMatch({
    ...createValidParticipantInput(),
    randomSource: () => 0.999999,
  });
}

function playFirst(state, dominoId) {
  const action = getLegalPlays(state, state.currentPlayerId).find(
    (play) => play.dominoId === dominoId,
  );
  return applyTurnAction(state, action);
}

test("seleccionar una ficha filtra sus destinos sin modificar el snapshot", () => {
  const state = createDeterministicMatch();
  const before = structuredClone(state);
  const presentations = [];
  const controller = new InteractionController({
    initialState: state,
    onChange: (presentation) => presentations.push(presentation),
  });

  controller.selectDomino("6-6");
  const presentation = presentations.at(-1);

  assert.equal(presentation.selectedDominoId, "6-6");
  assert.deepEqual(presentation.selectedLegalTargets, [{ kind: "START" }]);
  assert.equal(presentation.view.hand.length, 7);
  assert.deepEqual(state, before);
});

test("la primera jugada usa START, reaplica proyección y emite una sola acción", () => {
  const state = createDeterministicMatch();
  const before = structuredClone(state);
  const actions = [];
  const presentations = [];
  const controller = new InteractionController({
    initialState: state,
    requestAction: (snapshot, action) => {
      actions.push(structuredClone(action));
      return applyTurnAction(snapshot, action);
    },
    onChange: (presentation) => presentations.push(presentation),
  });

  controller.selectDomino("6-6");
  controller.submitTarget({ kind: "START" });

  assert.deepEqual(actions, [
    {
      type: "PLAY_DOMINO",
      playerId: "P4",
      dominoId: "6-6",
      target: { kind: "START" },
    },
  ]);
  assert.equal(controller.getState().board.mainLine.placementIds.length, 1);
  assert.equal(presentations.at(-1).view.edges.length, 1);
  assert.deepEqual(presentations.at(-1).view.latestAction, {
    sequence: 1,
    turnNumber: 1,
    playerId: "P4",
    teamId: "B",
    type: "PLAY_DOMINO",
    endedRound: false,
    dominoId: "6-6",
    placementId: "placement-1",
    openEndsSum: 12,
    scoreAwarded: 0,
  });
  assert.equal(
    presentations.at(-1).view.participants.players.find(
      (player) => player.playerId === "P4",
    ).remainingDominoCount,
    6,
  );
  assert.equal(presentations.at(-1).selectedDominoId, null);
  assert.deepEqual(state, before);
});

test("varios destinos iguales conservan el puerto individual enviado al motor", () => {
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
  const targets = controller.getPresentation().selectedLegalTargets;
  const chosenTarget = targets[2];

  controller.submitTarget(chosenTarget);
  const submitted = actions.at(-1);

  assert.equal(targets.length, 4);
  assert.deepEqual(submitted.target, {
    kind: "OPEN_END",
    placementId: chosenTarget.placementId,
    portId: chosenTarget.portId,
  });
  assert.equal(controller.getPresentation().view.edges.length, 2);
});

test("la inspección de una ficha jugada selecciona su estructura sin persistirla", () => {
  const initial = playFirst(createDeterministicMatch(), "6-6");
  const before = structuredClone(initial);
  const presentations = [];
  const controller = new InteractionController({
    initialState: initial,
    onChange: (presentation) => presentations.push(presentation),
  });

  assert.equal(controller.getPresentation().inspectedPlacementId, null);
  assert.equal(controller.getPresentation().inspectedStructureId, null);
  assert.equal(controller.inspectPlacement("placement-1"), "main");
  assert.equal(
    presentations.at(-1).inspectedPlacementId,
    "placement-1",
  );
  assert.equal(presentations.at(-1).inspectedStructureId, "main");
  assert.equal(controller.inspectPlacement("placement-1"), null);
  assert.equal(presentations.at(-1).inspectedPlacementId, null);
  assert.equal(presentations.at(-1).inspectedStructureId, null);
  assert.throws(
    () => controller.inspectPlacement("placement-999"),
    /no existe en el grafo/,
  );
  assert.deepEqual(initial, before);
});

test("una familia puede inspeccionarse desde su identidad visual sin elegir un brazo", () => {
  const state = playFirst(createDeterministicMatch(), "6-6");
  const before = structuredClone(state);
  const controller = new InteractionController({ initialState: state });

  assert.equal(
    controller.inspectStructure("branch-family:placement-1"),
    "branch-family:placement-1",
  );
  assert.equal(
    controller.getPresentation().inspectedStructureId,
    "branch-family:placement-1",
  );
  assert.equal(controller.getPresentation().inspectedPlacementId, null);
  assert.equal(controller.inspectStructure("branch-family:placement-1"), null);
  assert.throws(
    () => controller.inspectStructure("branch-family:placement-99"),
    /estructura no existe/,
  );
  assert.deepEqual(state, before);
});

test("una acción aceptada limpia la inspección sin crear estado reglamentario", () => {
  const controller = new InteractionController({
    initialState: createDeterministicMatch(),
  });
  controller.selectDomino("6-6");
  controller.submitTarget({ kind: "START" });
  controller.inspectPlacement("placement-1");
  controller.selectDomino("4-6");
  controller.submitTarget(
    controller.getPresentation().selectedLegalTargets[0],
  );

  assert.equal(controller.getPresentation().inspectedPlacementId, null);
  assert.equal(controller.getPresentation().inspectedStructureId, null);
  assert.equal("inspectedPlacementId" in controller.getState(), false);
  assert.equal("inspectedStructureId" in controller.getState(), false);
});

test("PASS se habilita y ejecuta exclusivamente desde getAvailableActions", () => {
  const state = createBlockedTurnState();
  const before = structuredClone(state);
  const controller = new InteractionController({ initialState: state });

  assert.equal(controller.getPresentation().canPass, true);
  controller.pass();

  assert.equal(controller.getState().history.at(-1).type, "PASS");
  assert.equal(controller.getState().consecutivePasses, 1);
  assert.deepEqual(state, before);
});

test("una transición terminal deshabilita selección, targets y PASS", () => {
  const state = createExitTurnState();
  const action = getLegalPlays(state, state.currentPlayerId)[0];
  const controller = new InteractionController({ initialState: state });

  controller.selectDomino(action.dominoId);
  controller.submitTarget(
    controller.getPresentation().selectedLegalTargets[0],
  );
  const presentation = controller.getPresentation();

  assert.equal(presentation.isFinished, true);
  assert.equal(presentation.view.roundStatus.phase, "finished");
  assert.equal(presentation.portView.roundStatus.phase, "finished");
  assert.deepEqual(presentation.view.legalPlays, []);
  assert.deepEqual(presentation.selectedLegalTargets, []);
  assert.equal(presentation.canPass, false);
  assert.throws(() => controller.pass(), /PASS no está disponible/);
  assert.throws(() => controller.selectDomino("0-0"), /ronda ya terminó/);
});
