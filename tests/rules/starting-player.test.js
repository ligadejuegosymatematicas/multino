import assert from "node:assert/strict";
import test from "node:test";

import {
  STARTING_DOMINO_ID,
  findStartingPlayerId,
} from "../../src/js/game/setup/StartingPlayer.js";
import { generateDoubleSixSet } from "../../src/js/game/model/Domino.js";
import { dealRoundRobin } from "../../src/js/game/setup/Deal.js";
import { createValidParticipantInput } from "../fixtures/participants.js";

for (const expectedPlayerId of ["P1", "P2", "P3", "P4"]) {
  test(`R-007: identifica 6-6 repartido a ${expectedPlayerId}`, () => {
    const dominoIds = generateDoubleSixSet().map((domino) => domino.id);
    const targetSeatIndex = Number(expectedPlayerId.slice(1)) - 1;
    const sixSixIndex = dominoIds.indexOf(STARTING_DOMINO_ID);
    [dominoIds[targetSeatIndex], dominoIds[sixSixIndex]] = [
      dominoIds[sixSixIndex],
      dominoIds[targetSeatIndex],
    ];
    const { seating } = createValidParticipantInput();
    const hands = dealRoundRobin(dominoIds, seating);

    assert.equal(findStartingPlayerId(hands), expectedPlayerId);
  });
}

