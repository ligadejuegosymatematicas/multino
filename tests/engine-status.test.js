import assert from "node:assert/strict";
import test from "node:test";

import { getEngineStatus } from "../src/js/game/index.js";
import { RULES_CAPABILITIES } from "../src/js/game/engine/Rules.js";
import { TURN_CAPABILITIES } from "../src/js/game/engine/TurnManager.js";

test("el diagnóstico distingue especificación completa de motor implementado", () => {
  const status = getEngineStatus();

  assert.equal(status.loaded, true);
  assert.equal(status.specificationComplete, true);
  assert.equal(status.matchSetupReady, true);
  assert.equal(status.boardPlayReady, true);
  assert.equal(status.gameplayReady, false);
  assert.equal(typeof status.stateSchemaVersion, "number");
  assert.equal(RULES_CAPABILITIES.randomDeal, "IMPLEMENTADA");
  assert.equal(RULES_CAPABILITIES.connectionCompatibility, "IMPLEMENTADA");
  assert.equal(RULES_CAPABILITIES.legalMoveChoice, "IMPLEMENTADA");
  assert.equal(RULES_CAPABILITIES.specialDoubleEligibility, "IMPLEMENTADA");
  assert.equal(RULES_CAPABILITIES.mainLineTopology, "IMPLEMENTADA");
  assert.equal(RULES_CAPABILITIES.branchTopology, "IMPLEMENTADA");
  assert.equal(TURN_CAPABILITIES.initialPlayer, "IMPLEMENTADA");
  assert.equal(TURN_CAPABILITIES.twoVsTwoOrder, "IMPLEMENTADA");
  assert.equal(
    TURN_CAPABILITIES.turnTransition,
    "ESPECIFICADA — NO IMPLEMENTADA",
  );
});
