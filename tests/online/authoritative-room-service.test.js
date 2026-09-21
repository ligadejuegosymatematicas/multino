import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthoritativeRoomService,
  ONLINE_INTENTS,
  ROOM_STATES,
} from "../../src/js/online/AuthoritativeRoomService.js";
import {
  ROUND_STRUCTURE_MODES,
  SEAT_CONTROL_TYPES,
} from "../../src/js/game/index.js";

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function intentFromAction(action) {
  return action.type === "PASS"
    ? { type: ONLINE_INTENTS.PASS }
    : {
        type: ONLINE_INTENTS.PLAY_TILE,
        dominoId: action.dominoId,
        target: structuredClone(action.target),
      };
}

async function createResolvedRoom(humanCount, seed = 1) {
  const service = new AuthoritativeRoomService({
    roomCodeFactory: () => `R${String(seed).padStart(4, "0")}`,
    randomSourceFactory: () => seededRandom(seed),
    clock: (() => {
      let tick = 0;
      return () => `2026-09-21T00:00:${String(tick++).padStart(2, "0")}Z`;
    })(),
  });
  let view = service.createRoom({ userId: "user-1", nick: "Uno" });
  for (let index = 1; index < humanCount; index += 1) {
    view = await service.joinRoom({
      roomCode: view.room.roomCode,
      userId: `user-${index + 1}`,
      nick: `Humano ${index + 1}`,
    });
  }
  for (let seatIndex = humanCount; seatIndex < 4; seatIndex += 1) {
    view = await service.setSeatControl({
      roomCode: view.room.roomCode,
      userId: "user-1",
      seatIndex,
      controlType: SEAT_CONTROL_TYPES.CPU,
    });
  }
  return { service, roomCode: view.room.roomCode };
}

async function startRoom(service, roomCode) {
  const before = service.getView({ roomCode, userId: "user-1" });
  return service.submitIntent({
    roomCode,
    userId: "user-1",
    expectedVersion: before.room.version,
    intent: { type: ONLINE_INTENTS.START_MATCH, mode: ROUND_STRUCTURE_MODES.BRANCHED },
  });
}

async function playCompleteRound(service, roomCode) {
  let view = await startRoom(service, roomCode);
  for (let turn = 0; turn < 120 && view.room.status === ROOM_STATES.PLAYING; turn += 1) {
    const currentSeat = view.room.seats.find(
      (seat) => seat.seatId === view.publicMatch.currentPlayerId,
    );
    assert.equal(currentSeat.controlType, SEAT_CONTROL_TYPES.HUMAN);
    view = service.getView({ roomCode, userId: currentSeat.userId });
    const action = view.privateMatch.legalActions[0];
    view = await service.submitIntent({
      roomCode,
      userId: currentSeat.userId,
      expectedVersion: view.room.version,
      intent: intentFromAction(action),
    });
  }
  assert.equal(view.room.status, ROOM_STATES.FINISHED);
  return view;
}

test("salas 4H, 3H+1CPU, 2H+2CPU y 1H+3CPU completan una ronda", async () => {
  for (const humanCount of [4, 3, 2, 1]) {
    const { service, roomCode } = await createResolvedRoom(humanCount, 40 + humanCount);
    const final = await playCompleteRound(service, roomCode);
    assert.equal(final.publicMatch.phase, "finished");
    assert.ok(final.publicMatch.history.length > 0);
    assert.equal(final.publicMatch.roundResult.winnerTeamId !== undefined, true);
  }
});

test("la vista pública nunca contiene manos y la privada contiene solo la propia", async () => {
  const { service, roomCode } = await createResolvedRoom(4, 12);
  await startRoom(service, roomCode);
  const first = service.getView({ roomCode, userId: "user-1" });
  const second = service.getView({ roomCode, userId: "user-2" });
  assert.equal("hands" in first.publicMatch, false);
  assert.equal("dominoes" in first.publicMatch, false);
  assert.equal(first.privateMatch.hand.length, 7);
  assert.equal(second.privateMatch.hand.length, 7);
  assert.equal(
    first.privateMatch.hand.some((tile) => second.privateMatch.hand.includes(tile)),
    false,
  );
  assert.equal(Object.keys(first.privateMatch.dominoes).length, 7);
});

test("rechaza usuario ajeno, fuera de turno y acciones ilegales", async () => {
  const { service, roomCode } = await createResolvedRoom(4, 19);
  const started = await startRoom(service, roomCode);
  assert.throws(
    () => service.getView({ roomCode, userId: "intruso" }),
    (error) => error.code === "NOT_ROOM_MEMBER",
  );
  const current = started.room.seats.find(
    (seat) => seat.seatId === started.publicMatch.currentPlayerId,
  );
  const other = started.room.seats.find(
    (seat) => seat.userId && seat.userId !== current.userId,
  );
  await assert.rejects(
    service.submitIntent({
      roomCode,
      userId: other.userId,
      expectedVersion: started.room.version,
      intent: { type: ONLINE_INTENTS.PASS },
    }),
    (error) => error.code === "OUT_OF_TURN",
  );
  await assert.rejects(
    service.submitIntent({
      roomCode,
      userId: current.userId,
      expectedVersion: started.room.version,
      intent: { type: ONLINE_INTENTS.PLAY_TILE, dominoId: "tile:99-99", target: { kind: "START" } },
    }),
    (error) => error.code === "ILLEGAL_ACTION",
  );
});

test("doble click y concurrencia aceptan una sola versión", async () => {
  const { service, roomCode } = await createResolvedRoom(4, 27);
  const started = await startRoom(service, roomCode);
  const current = started.room.seats.find(
    (seat) => seat.seatId === started.publicMatch.currentPlayerId,
  );
  const view = service.getView({ roomCode, userId: current.userId });
  const payload = {
    roomCode,
    userId: current.userId,
    expectedVersion: view.room.version,
    intent: intentFromAction(view.privateMatch.legalActions[0]),
  };
  const results = await Promise.allSettled([
    service.submitIntent(payload),
    service.submitIntent(payload),
  ]);
  assert.equal(results.filter(({ status }) => status === "fulfilled").length, 1);
  const rejected = results.find(({ status }) => status === "rejected");
  assert.equal(rejected.reason.code, "STALE_VERSION");
});

test("refresh recupera usuario y asiento; la CPU no depende del host", async () => {
  const { service, roomCode } = await createResolvedRoom(2, 51);
  let view = await startRoom(service, roomCode);
  const currentSeat = view.room.seats.find(
    (seat) => seat.seatId === view.publicMatch.currentPlayerId,
  );
  view = service.getView({ roomCode, userId: currentSeat.userId });
  view = await service.submitIntent({
    roomCode,
    userId: currentSeat.userId,
    expectedVersion: view.room.version,
    intent: intentFromAction(view.privateMatch.legalActions[0]),
  });
  service.disconnect({ roomCode, userId: "user-1" });
  const reconnected = service.reconnect({ roomCode, userId: "user-1" });
  assert.equal(
    reconnected.room.seats.find((seat) => seat.userId === "user-1").seatId,
    "seat-1",
  );

  const nextSeat = view.room.seats.find(
    (seat) => seat.seatId === view.publicMatch.currentPlayerId,
  );
  if (nextSeat.userId === "user-2") {
    service.disconnect({ roomCode, userId: "user-1" });
    const secondView = service.getView({ roomCode, userId: "user-2" });
    const beforeVersion = secondView.room.version;
    const after = await service.submitIntent({
      roomCode,
      userId: "user-2",
      expectedVersion: beforeVersion,
      intent: intentFromAction(secondView.privateMatch.legalActions[0]),
    });
    assert.ok(after.room.version >= beforeVersion + 3, "la acción humana debe disparar CPU servidor");
  }
});
