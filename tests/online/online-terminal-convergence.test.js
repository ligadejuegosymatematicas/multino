import assert from "node:assert/strict";
import test from "node:test";

import {
  AuthoritativeRoomService,
  ONLINE_INTENTS,
  ROOM_STATES,
} from "../../src/js/online/AuthoritativeRoomService.js";
import {
  OnlineGameSessionController,
} from "../../src/js/online/OnlineGameSessionController.js";
import { ROUND_STRUCTURE_MODES } from "../../src/js/game/index.js";

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function toDatabaseRoom(view) {
  return {
    id: `room:${view.room.roomCode}`,
    code: view.room.roomCode,
    host_user_id: view.room.ownerUserId,
    status: view.room.status,
    version: view.room.version,
    room_seats: view.room.seats.map((seat) => ({
      id: `${view.room.roomCode}:${seat.seatId}`,
      seat_index: seat.seatIndex,
      team_id: seat.teamId,
      control_type: seat.controlType,
      user_id: seat.userId,
      nick: seat.nick,
      connection_state: seat.connectionState,
    })),
  };
}

function toMatch(view) {
  return {
    version: view.room.version,
    publicMatch: structuredClone(view.publicMatch),
    privateMatch: structuredClone(view.privateMatch),
  };
}

class FourClientHarness {
  constructor({ service, roomCode, userIds }) {
    this.service = service;
    this.roomCode = roomCode;
    this.userIds = userIds;
    this.listeners = new Map(userIds.map((userId) => [userId, new Set()]));
    this.snapshots = new Map(userIds.map((userId) => [userId, new Map()]));
    this.record();
  }

  record() {
    for (const userId of this.userIds) {
      const view = this.service.getView({ roomCode: this.roomCode, userId });
      const sequence = view.publicMatch?.history?.at(-1)?.sequence ?? 0;
      this.snapshots.get(userId).set(sequence, toMatch(view));
    }
  }

  latest(userId) {
    return toMatch(this.service.getView({ roomCode: this.roomCode, userId }));
  }

  sync(userId, afterSequence = null) {
    const latest = this.latest(userId);
    if (!Number.isSafeInteger(afterSequence)) return latest;
    const snapshots = this.snapshots.get(userId);
    const sequences = [...snapshots.keys()].sort((first, second) => first - second);
    const baseSequence = sequences.filter((sequence) => sequence <= afterSequence).at(-1) ?? 0;
    const presentationBase = structuredClone(snapshots.get(baseSequence));
    const presentationFrames = sequences
      .filter((sequence) => sequence > afterSequence)
      .map((sequence) => {
        const match = structuredClone(snapshots.get(sequence));
        return {
          sequence,
          actorSeatId: match.publicMatch.history.at(-1)?.playerId ?? null,
          match,
        };
      });
    return { ...latest, presentationBase, presentationFrames };
  }

  async submit(userId, payload) {
    const beforeSequence = this.latest(userId).publicMatch.history.at(-1)?.sequence ?? 0;
    await this.service.submitIntent({
      roomCode: this.roomCode,
      userId,
      expectedVersion: payload.expectedVersion,
      intent: payload.intent,
    });
    this.record();
    return this.sync(userId, beforeSequence);
  }

  broadcast() {
    const view = this.service.getView({
      roomCode: this.roomCode,
      userId: this.userIds[0],
    });
    for (const listeners of this.listeners.values()) {
      for (const listener of listeners) listener(view.room.version);
    }
  }

  gateway(userId) {
    return {
      ensureAnonymousIdentity: async () => ({ id: userId }),
      sendLobbyIntent: async (intent) => {
        assert.equal(intent.type, "GET_ROOM");
        return toDatabaseRoom(this.service.getView({
          roomCode: this.roomCode,
          userId,
        }));
      },
      sendIntent: async (payload) => this.submit(userId, payload),
      syncMatch: async (_roomCode, { afterSequence = null } = {}) =>
        this.sync(userId, afterSequence),
      subscribeRoom: (_roomId, onVersion, onStatus) => {
        this.listeners.get(userId).add(onVersion);
        onStatus?.("SUBSCRIBED");
        return () => this.listeners.get(userId).delete(onVersion);
      },
    };
  }
}

async function createFourHumanRoom(seed = 311) {
  const service = new AuthoritativeRoomService({
    roomCodeFactory: () => "FINAL4",
    randomSourceFactory: () => seededRandom(seed),
  });
  const userIds = ["user-a", "user-b", "user-c", "user-d"];
  let view = service.createRoom({ userId: userIds[0], nick: "Alicia" });
  for (let index = 1; index < userIds.length; index += 1) {
    view = await service.joinRoom({
      roomCode: view.room.roomCode,
      userId: userIds[index],
      nick: `Jugador ${index + 1}`,
    });
  }
  await service.submitIntent({
    roomCode: view.room.roomCode,
    userId: userIds[0],
    expectedVersion: view.room.version,
    intent: { type: ONLINE_INTENTS.START_MATCH, mode: ROUND_STRUCTURE_MODES.BRANCHED },
  });
  return { service, roomCode: view.room.roomCode, userIds };
}

async function waitForAuthoritativeSequence(controllers, sequence) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (controllers.every((controller) =>
      controller.getPresentation().presentationQueue.authoritativeSequence === sequence
    )) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`Los cuatro clientes no recibieron la secuencia ${sequence}.`);
}

function drainOneMove(controller) {
  const before = controller.getPresentation();
  assert.equal(before.presentationQueue.phase, "announce");
  assert.equal(controller.advancePresentation(), true);
  const move = controller.getPresentation();
  assert.equal(move.presentationQueue.phase, "move");
  assert.equal(controller.completePresentation(), true);
  return move;
}

test("cuatro clientes presentan la última jugada y convergen al mismo FINISHED", async () => {
  const { service, roomCode, userIds } = await createFourHumanRoom();
  const harness = new FourClientHarness({ service, roomCode, userIds });
  const controllers = userIds.map((userId) =>
    new OnlineGameSessionController({ gateway: harness.gateway(userId) })
  );
  await Promise.all(controllers.map((controller) => controller.start({ roomCode })));
  const controllerBySeatId = new Map(
    controllers.map((controller) => {
      const presentation = controller.getPresentation();
      return [presentation.round.handPrivacy.playerId, controller];
    }),
  );

  let terminalMoves = null;
  for (let turn = 0; turn < 120; turn += 1) {
    const authority = service.getView({ roomCode, userId: userIds[0] });
    if (authority.room.status === ROOM_STATES.FINISHED) break;
    const actorSeatId = authority.publicMatch.currentPlayerId;
    const actorSeat = authority.room.seats.find((seat) => seat.seatId === actorSeatId);
    const actorController = controllerBySeatId.get(actorSeatId);
    const actorView = service.getView({ roomCode, userId: actorSeat.userId });
    const action = actorView.privateMatch.legalActions[0];
    if (action.type === "PASS") {
      await actorController.pass();
    } else {
      actorController.selectDomino(action.dominoId);
      await actorController.submitTarget(action.target);
    }

    const nextAuthority = service.getView({ roomCode, userId: userIds[0] });
    const sequence = nextAuthority.publicMatch.history.at(-1).sequence;
    harness.broadcast();
    await waitForAuthoritativeSequence(controllers, sequence);
    const isTerminal = nextAuthority.room.status === ROOM_STATES.FINISHED;
    if (isTerminal) {
      for (const controller of controllers) {
        const waiting = controller.getPresentation();
        assert.equal(waiting.presentationQueue.phase, "announce");
        assert.equal(waiting.round.isFinished, false);
        assert.equal(waiting.round.handPrivacy.canAct, false);
      }
    }
    const moves = controllers.map(drainOneMove);
    if (isTerminal) {
      terminalMoves = moves;
      break;
    }
  }

  assert.ok(terminalMoves, "la ronda debe alcanzar una última jugada observable");
  const finalAuthority = service.getView({ roomCode, userId: userIds[0] });
  const finalSequence = finalAuthority.publicMatch.history.at(-1).sequence;
  for (const move of terminalMoves) {
    assert.equal(move.presentationQueue.presentedSequence, finalSequence);
    assert.equal(move.round.isFinished, true);
    assert.equal(move.round.view.scoringPresentation.enabled, true);
  }

  const finalPresentations = controllers.map((controller) => controller.getPresentation());
  for (const presentation of finalPresentations) {
    assert.equal(presentation.room.status, ROOM_STATES.FINISHED);
    assert.equal(presentation.round.isFinished, true);
    assert.equal(presentation.round.handPrivacy.canAct, false);
    assert.equal(presentation.round.canPass, false);
    assert.equal(presentation.presentationQueue.phase, "idle");
    assert.equal(presentation.presentationQueue.presentedSequence, finalSequence);
  }
  assert.deepEqual(
    controllers.map((controller) => controller.authoritativeMatch.version),
    Array(4).fill(finalAuthority.room.version),
  );
  assert.deepEqual(
    controllers.map((controller) => controller.authoritativeMatch.publicMatch.score),
    Array(4).fill(finalAuthority.publicMatch.score),
  );
  assert.deepEqual(
    controllers.map((controller) => controller.authoritativeMatch.publicMatch.roundResult),
    Array(4).fill(finalAuthority.publicMatch.roundResult),
  );
  assert.deepEqual(
    controllers.map((controller) => controller.authoritativeMatch.publicMatch.phase),
    Array(4).fill("finished"),
  );
  for (const controller of controllers) {
    const match = controller.authoritativeMatch;
    assert.equal(Object.hasOwn(match.publicMatch, "hands"), false);
    assert.equal(Object.hasOwn(match.publicMatch, "dominoes"), false);
    assert.equal(Object.hasOwn(match.privateMatch, "rivalHands"), false);
    assert.deepEqual(
      Object.keys(match.privateMatch.dominoes).sort(),
      [...match.privateMatch.hand].sort(),
    );
  }

  const refreshed = new OnlineGameSessionController({
    gateway: harness.gateway(userIds[1]),
  });
  await refreshed.start({ roomCode });
  const recovered = refreshed.getPresentation();
  assert.equal(recovered.room.status, ROOM_STATES.FINISHED);
  assert.equal(recovered.round.isFinished, true);
  assert.equal(recovered.presentationQueue.phase, "idle");
  assert.deepEqual(
    refreshed.authoritativeMatch.publicMatch.roundResult,
    finalAuthority.publicMatch.roundResult,
  );
});

test("salir de pantalla y refresh recuperan identidad, asiento, mano y canal sin JOIN; FINISHED recupera directo", async () => {
  const { service, roomCode, userIds } = await createFourHumanRoom();
  const harness = new FourClientHarness({ service, roomCode, userIds });
  const membership = structuredClone(service.getView({ roomCode, userId: userIds[1] }).room.seats);
  let joins = 0;
  const restore = async (userId) => {
    const gateway = harness.gateway(userId);
    const send = gateway.sendLobbyIntent;
    gateway.sendLobbyIntent = async (intent) => {
      if (intent.type === "JOIN_ROOM") joins++;
      return send(intent);
    };
    const controller = new OnlineGameSessionController({ gateway });
    await controller.start({ roomCode });
    const p = controller.getPresentation();
    const authority = harness.latest(userId);
    assert.equal(p.userId, userId);
    assert.equal(p.room.roomCode, roomCode);
    assert.equal(p.room.seats.length, 4);
    assert.equal(p.room.seats.filter(seat => seat.userId === userId).length, 1);
    const own = p.room.seats.find(seat => seat.userId === userId);
    const original = membership.find(seat => seat.userId === userId);
    assert.equal(own.seatId, `${roomCode}:${original.seatId}`);
    assert.equal(own.seatIndex, original.seatIndex);
    assert.equal(own.teamId, original.teamId);
    assert.equal(own.nick, original.nick);
    assert.deepEqual(controller.authoritativeMatch, authority);
    assert.deepEqual(controller.match.privateMatch.hand, authority.privateMatch.hand);
    assert.equal(p.presentationQueue.phase, "idle");
    assert.equal(harness.listeners.get(userId).size, 1, "exactamente un canal activo");
    assert.equal(Object.hasOwn(authority.publicMatch, "hands"), false);
    assert.deepEqual(Object.keys(authority.privateMatch.dominoes).sort(), [...authority.privateMatch.hand].sort());
    return controller;
  };
  let clients = await Promise.all(userIds.map(restore));
  // Refresh: destroy only presentation, never membership or the persisted identity.
  clients[1].dispose();
  assert.equal(harness.listeners.get(userIds[1]).size, 0);
  clients[1] = await restore(userIds[1]);

  for (let turn = 0; turn < 120; turn++) {
    const view = service.getView({ roomCode, userId: userIds[0] });
    if (view.room.status === ROOM_STATES.FINISHED) break;
    const actor = view.room.seats.find(seat => seat.seatId === view.publicMatch.currentPlayerId);
    // A non-actor leaves the screen. The other human can legally advance the round.
    const absentIndex = (userIds.indexOf(actor.userId) + 1) % 4;
    const absentId = userIds[absentIndex];
    clients[absentIndex].dispose();
    const action = service.getView({ roomCode, userId: actor.userId }).privateMatch.legalActions[0];
    await harness.submit(actor.userId, { expectedVersion: view.room.version, intent: action.type === "PASS"
      ? { type: "PASS" } : { type: "PLAY_TILE", dominoId: action.dominoId, target: action.target } });
    harness.broadcast();
    clients[absentIndex] = await restore(absentId);
    const after = clients[absentIndex].getPresentation();
    if (after.round.isFinished) {
      assert.equal(after.presentationQueue.phase, "idle");
      assert.equal(after.round.handPrivacy.canAct, false);
      assert.equal(after.round.canPass, false);
    }
  }
  assert.equal(service.getView({ roomCode, userId: userIds[0] }).room.status, ROOM_STATES.FINISHED);
  for (let index = 0; index < 4; index++) {
    clients[index].dispose();
    clients[index] = await restore(userIds[index]);
    assert.equal(clients[index].getPresentation().round.isFinished, true);
    clients[index].dispose();
  }
  assert.equal(joins, 0);
  assert.deepEqual(service.getView({ roomCode, userId: userIds[1] }).room.seats, membership);
});
