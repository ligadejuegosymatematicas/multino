import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultSeats,
  createSeat,
  participantsFromSeats,
  SEAT_CONTROL_TYPES,
  validateSeats,
} from "../../src/js/game/index.js";

test("la mesa fija cuatro asientos y equipos alternados", () => {
  const seats = createDefaultSeats({ humanCount: 2, nick: "Henry" });
  assert.equal(seats.length, 4);
  assert.deepEqual(seats.map((seat) => seat.teamId), ["A", "B", "A", "B"]);
  assert.deepEqual(
    participantsFromSeats(seats).seating.counterclockwisePlayerIds,
    ["seat-1", "seat-2", "seat-3", "seat-4"],
  );
  assert.deepEqual(
    participantsFromSeats(seats).teams.map((team) => team.playerIds),
    [["seat-1", "seat-3"], ["seat-2", "seat-4"]],
  );
  assert.deepEqual(
    participantsFromSeats(seats).teams.map((team) => team.displayName),
    ["Equipo A", "Equipo B"],
  );
});

for (const humanCount of [1, 2, 3, 4]) {
  test(`admite ${humanCount} humanos y ${4 - humanCount} CPU`, () => {
    const seats = createDefaultSeats({ humanCount });
    assert.equal(
      seats.filter((seat) => seat.controlType === SEAT_CONTROL_TYPES.HUMAN).length,
      humanCount,
    );
  });
}

test("rechaza mesas sin humano y cantidades distintas de cuatro", () => {
  assert.throws(
    () => validateSeats(Array.from({ length: 4 }, (_, seatIndex) =>
      createSeat({ seatIndex, controlType: SEAT_CONTROL_TYPES.CPU })
    )),
    /al menos un jugador humano/,
  );
  assert.throws(() => validateSeats([]), /exactamente cuatro/);
});
