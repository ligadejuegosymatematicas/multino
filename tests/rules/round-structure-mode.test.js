import assert from "node:assert/strict";
import test from "node:test";

import {
  getInternalSpecialDoubleLimit,
  getRoundStructureMode,
  ROUND_STRUCTURE_MODES,
  validateRoundStructureMode,
} from "../../src/js/game/setup/MatchConfig.js";
import { assertThrowsDomainCode } from "../fixtures/assertions.js";

for (const mode of Object.values(ROUND_STRUCTURE_MODES)) {
  test(`acepta el modo público ${mode}`, () => {
    assert.equal(validateRoundStructureMode(mode), mode);
  });
}

test("rechaza modos estructurales ajenos al contrato", () => {
  assertThrowsDomainCode(
    () => validateRoundStructureMode("K=7"),
    "INVALID_ROUND_STRUCTURE_MODE",
  );
});

test("schema v6 usa únicamente 1/0 como codificación de partidas nuevas", () => {
  assert.equal(getInternalSpecialDoubleLimit(ROUND_STRUCTURE_MODES.BRANCHED), 1);
  assert.equal(getInternalSpecialDoubleLimit(ROUND_STRUCTURE_MODES.LINEAR), 0);
  assert.equal(getRoundStructureMode(1), ROUND_STRUCTURE_MODES.BRANCHED);
  assert.equal(getRoundStructureMode(0), ROUND_STRUCTURE_MODES.LINEAR);
});

test("un valor legado positivo se interpreta como Ramificado", () => {
  assert.equal(getRoundStructureMode(7), ROUND_STRUCTURE_MODES.BRANCHED);
});
