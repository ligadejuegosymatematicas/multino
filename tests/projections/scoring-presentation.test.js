import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  applyTurnAction,
  createScoringPresentation,
  getLegalPlays,
  getOpenEndTargets,
  getScoringPresentation,
  PLAY_SCORING_POLICY,
  SCORING_PRESENTATION_POLICY_TYPES,
} from "../../src/js/game/index.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

function playFirstTurn(state, dominoId) {
  const action = getLegalPlays(state, state.currentPlayerId).find(
    (candidate) => candidate.dominoId === dominoId,
  );
  return applyTurnAction(state, action);
}

test("la presentación puntuable deriva S, divisor y cociente de una sola política", () => {
  const initial = createBoardScenario({ K: 1, firstDominoId: "5-5" });
  const before = structuredClone(initial);
  const state = playFirstTurn(initial, "5-5");
  const presentation = getScoringPresentation(state);

  assert.equal(PLAY_SCORING_POLICY.divisor, 5);
  assert.equal(presentation.enabled, true);
  assert.equal(
    presentation.policyType,
    SCORING_PRESENTATION_POLICY_TYPES.DIVISIBLE,
  );
  assert.equal(presentation.divisor, PLAY_SCORING_POLICY.divisor);
  assert.equal(presentation.expression, "2×5");
  assert.deepEqual(
    presentation.terms.map(({ value, factor, contribution, label }) => ({
      value,
      factor,
      contribution,
      label,
    })),
    [{ value: 5, factor: 2, contribution: 10, label: "2×5" }],
  );
  assert.equal(presentation.latestResolution.sum, 10);
  assert.equal(presentation.latestResolution.isDivisible, true);
  assert.equal(presentation.latestResolution.quotient, 2);
  assert.equal(presentation.latestResolution.scoreAwarded, 2);
  assert.equal(
    presentation.latestResolution.scoreAwarded,
    presentation.latestResolution.quotient,
  );
  assert.deepEqual(initial, before);
});

test("una jugada no múltiplo produce resolución explícita sin puntos", () => {
  const state = playFirstTurn(
    createBoardScenario({ K: 7, firstDominoId: "6-6" }),
    "6-6",
  );
  const resolution = getScoringPresentation(state).latestResolution;

  assert.equal(resolution.expression, "2×6");
  assert.equal(resolution.sum, 12);
  assert.equal(resolution.divisor, 5);
  assert.equal(resolution.isDivisible, false);
  assert.equal(resolution.quotient, null);
  assert.equal(resolution.scoreAwarded, 0);
});

test("un chancho con puerto libre puede aportar cero sin confundirse con targets", () => {
  let state = createBoardScenario({ K: 1, firstDominoId: "5-5" });
  state = playDomino(state, "5-5");
  state = playDomino(state, "1-5", targetAt("placement-1", "main:1"));
  state = playDomino(state, "2-5", targetAt("placement-1", "main:2"));
  state = playDomino(state, "3-5", targetAt("placement-1", "branch:1"));

  const presentation = getScoringPresentation(state);
  const doubleTerm = presentation.terms.find(
    (term) => term.placementId === "placement-1",
  );
  const freeDoublePorts = getOpenEndTargets(state).filter(
    (target) => target.placementId === "placement-1",
  );

  assert.deepEqual(
    {
      value: doubleTerm.value,
      factor: doubleTerm.factor,
      contribution: doubleTerm.contribution,
      isContributing: doubleTerm.isContributing,
      label: doubleTerm.label,
    },
    {
      value: 5,
      factor: 0,
      contribution: 0,
      isContributing: false,
      label: "0",
    },
  );
  assert.deepEqual(
    freeDoublePorts.map(({ placementId, portId }) => ({ placementId, portId })),
    [{ placementId: "placement-1", portId: "branch:2" }],
  );
  assert.equal(presentation.latestResolution, null);
});

test("la política futura disabled oculta S sin activar una variante", () => {
  const presentation = createScoringPresentation({
    terms: [{ thisWouldBeInvalidIfEvaluated: true }],
    sum: 25,
    latestAction: { type: "PLAY_DOMINO" },
    policy: {
      enabled: false,
      policyType: SCORING_PRESENTATION_POLICY_TYPES.DISABLED,
      divisor: null,
    },
  });

  assert.deepEqual(presentation, {
    enabled: false,
    policyType: SCORING_PRESENTATION_POLICY_TYPES.DISABLED,
    divisor: null,
    terms: [],
    sum: null,
    expression: null,
    latestResolution: null,
  });
});

test("los renderers no codifican por su cuenta el divisor reglamentario", async () => {
  for (const file of [
    "../../src/js/ui/GameFeedback.js",
    "../../src/js/ui/ScorePanel.js",
    "../../src/js/ui/GraphRenderer.js",
    "../../src/js/ui/TraditionalRenderer.js",
  ]) {
    const source = await readFile(new URL(file, import.meta.url), "utf8");
    assert.doesNotMatch(source, /(?:divisor|múltiplo)\s*(?:===?|de|:)\s*5|%\s*5|\/\s*5/i);
  }
});
