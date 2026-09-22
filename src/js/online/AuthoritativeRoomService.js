import {
  applyTurnAction,
  chooseCpuAction,
  createCpuSeatView,
  createMatch,
  createSeat,
  getAvailableActions,
  participantsFromSeats,
  projectGraphView,
  projectPortView,
  projectTraditionalView,
  ROUND_STRUCTURE_MODES,
  SEAT_CONTROL_TYPES,
} from "../game/index.js";

export const ONLINE_INTENTS = Object.freeze({
  START_MATCH: "START_MATCH",
  PLAY_TILE: "PLAY_TILE",
  PASS: "PASS",
});

export const ROOM_STATES = Object.freeze({
  LOBBY: "LOBBY",
  PLAYING: "PLAYING",
  FINISHED: "FINISHED",
});

function onlineError(code, message, details = {}) {
  return Object.assign(new Error(message), { code, details });
}

function normalizeNick(nick) {
  const value = String(nick ?? "").trim();
  if (!value) throw onlineError("NICK_REQUIRED", "El nick es obligatorio.");
  return value.slice(0, 24);
}

function actionMatchesIntent(action, intent) {
  if (intent.type === ONLINE_INTENTS.PASS) return action.type === "PASS";
  if (action.type !== "PLAY_DOMINO" || action.dominoId !== intent.dominoId) {
    return false;
  }
  if (action.target.kind !== intent.target?.kind) return false;
  if (action.target.kind === "START") return true;
  return action.target.placementId === intent.target.placementId &&
    action.target.portId === intent.target.portId;
}

export function createPublicOnlineState(state) {
  if (!state) return null;
  const playedDominoIds = new Set(
    Object.values(state.board.placements).map((placement) => placement.dominoId),
  );
  const publicState = {
    matchId: state.matchId,
    schemaVersion: state.schemaVersion,
    phase: state.phase,
    turnNumber: state.turnNumber,
    currentPlayerId: state.currentPlayerId,
    consecutivePasses: state.consecutivePasses,
    players: structuredClone(state.players),
    teams: structuredClone(state.teams),
    seating: structuredClone(state.seating),
    board: structuredClone(state.board),
    score: structuredClone(state.score),
    history: structuredClone(state.history),
    config: structuredClone(state.config),
    remainingDominoCountByPlayer: Object.fromEntries(
      Object.entries(state.hands).map(([playerId, hand]) => [playerId, hand.length]),
    ),
    playedDominoes: Object.fromEntries(
      [...playedDominoIds].map((dominoId) => [
        dominoId,
        structuredClone(state.dominoes[dominoId]),
      ]),
    ),
  };
  if (state.roundResult) {
    publicState.roundResult = structuredClone(state.roundResult);
  }
  return publicState;
}

function protectProjection(projection, isCurrentPlayer) {
  if (isCurrentPlayer) return projection;
  return {
    ...projection,
    hand: projection.hand.map((domino) => ({
      ...domino,
      legalTargetCount: 0,
    })),
    legalPlays: [],
  };
}

export function createPrivateOnlineState(state, seatId) {
  const isCurrentPlayer = state.phase === "playing" &&
    state.currentPlayerId === seatId;
  return {
    seatId,
    hand: [...state.hands[seatId]],
    dominoes: Object.fromEntries(
      state.hands[seatId].map((dominoId) => [
        dominoId,
        structuredClone(state.dominoes[dominoId]),
      ]),
    ),
    legalActions: isCurrentPlayer
      ? structuredClone(getAvailableActions(state))
      : [],
    render: {
      graph: protectProjection(projectGraphView(state, seatId), isCurrentPlayer),
      ports: protectProjection(projectPortView(state, seatId), isCurrentPlayer),
      traditional: protectProjection(
        projectTraditionalView(state, seatId),
        isCurrentPlayer,
      ),
    },
  };
}

function createLobbySeat(seatIndex, { userId = null, nick = null } = {}) {
  return {
    seatId: `seat-${seatIndex + 1}`,
    seatIndex,
    teamId: seatIndex % 2 === 0 ? "A" : "B",
    controlType: SEAT_CONTROL_TYPES.HUMAN,
    userId,
    nick: nick ?? `Asiento ${seatIndex + 1}`,
    connectionState: userId ? "CONNECTED" : "EMPTY",
    cpuDifficulty: null,
  };
}

/**
 * Núcleo autoritativo portable. En producción lo invoca una función servidor;
 * en tests usa memoria, sin confiar nunca en snapshots enviados por clientes.
 */
export class AuthoritativeRoomService {
  constructor({
    randomSourceFactory = () => Math.random,
    clock = () => new Date().toISOString(),
    roomCodeFactory = () => Math.random().toString(36).slice(2, 7).toUpperCase(),
    cpuChooser = chooseCpuAction,
  } = {}) {
    this.randomSourceFactory = randomSourceFactory;
    this.clock = clock;
    this.roomCodeFactory = roomCodeFactory;
    this.cpuChooser = cpuChooser;
    this.rooms = new Map();
    this.profiles = new Map();
    this.listeners = new Map();
  }

  createRoom({ userId, nick }) {
    if (!userId) throw onlineError("AUTH_REQUIRED", "Se requiere identidad anónima.");
    const roomCode = this.#uniqueRoomCode();
    const normalizedNick = normalizeNick(nick);
    const seats = Array.from({ length: 4 }, (_, seatIndex) =>
      createLobbySeat(seatIndex, seatIndex === 0
        ? { userId, nick: normalizedNick }
        : undefined)
    );
    const room = {
      roomCode,
      ownerUserId: userId,
      status: ROOM_STATES.LOBBY,
      version: 0,
      seats,
      state: null,
      initialState: null,
      startedAt: null,
      finishedAt: null,
      moves: [],
      lock: Promise.resolve(),
    };
    this.profiles.set(userId, { userId, nick: normalizedNick });
    this.rooms.set(roomCode, room);
    return this.getView({ roomCode, userId });
  }

  joinRoom({ roomCode, userId, nick }) {
    return this.#enqueue(roomCode, () => {
      const room = this.#room(roomCode);
      if (room.status !== ROOM_STATES.LOBBY) {
        throw onlineError("ROOM_ALREADY_STARTED", "La sala ya comenzó.");
      }
      const existing = room.seats.find((seat) => seat.userId === userId);
      if (existing) {
        existing.connectionState = "CONNECTED";
        return this.#view(room, userId);
      }
      const seat = room.seats.find(
        (candidate) => candidate.controlType === SEAT_CONTROL_TYPES.HUMAN &&
          candidate.userId === null,
      );
      if (!seat) throw onlineError("ROOM_FULL", "La sala no tiene asientos humanos libres.");
      seat.userId = userId;
      seat.nick = normalizeNick(nick);
      seat.connectionState = "CONNECTED";
      this.profiles.set(userId, { userId, nick: seat.nick });
      this.#advanceVersion(room);
      return this.#view(room, userId);
    });
  }

  setSeatControl({ roomCode, userId, seatIndex, controlType }) {
    return this.#enqueue(roomCode, () => {
      const room = this.#room(roomCode);
      this.#requireHost(room, userId);
      if (room.status !== ROOM_STATES.LOBBY) {
        throw onlineError("ROOM_ALREADY_STARTED", "La sala ya comenzó.");
      }
      if (![SEAT_CONTROL_TYPES.HUMAN, SEAT_CONTROL_TYPES.CPU].includes(controlType)) {
        throw onlineError("INVALID_CONTROL", "El asiento debe ser HUMAN o CPU.");
      }
      const seat = room.seats[seatIndex];
      if (!seat) throw onlineError("UNKNOWN_SEAT", "El asiento no existe.");
      if (seat.userId && seat.userId !== userId) {
        throw onlineError(
          "CONNECTED_HUMAN_PROTECTED",
          "No se puede reemplazar a un humano conectado.",
        );
      }
      if (seat.userId === userId && seatIndex === 0 && controlType === SEAT_CONTROL_TYPES.CPU) {
        throw onlineError("HUMAN_REQUIRED", "La sala necesita al menos un humano.");
      }
      seat.controlType = controlType;
      seat.userId = controlType === SEAT_CONTROL_TYPES.CPU ? null : seat.userId;
      seat.nick = controlType === SEAT_CONTROL_TYPES.CPU
        ? `CPU ${seatIndex + 1}`
        : `Asiento ${seatIndex + 1}`;
      seat.connectionState = controlType === SEAT_CONTROL_TYPES.CPU ? "SERVER" : "EMPTY";
      seat.cpuDifficulty = controlType === SEAT_CONTROL_TYPES.CPU ? "V1" : null;
      this.#advanceVersion(room);
      return this.#view(room, userId);
    });
  }

  submitIntent({ roomCode, userId, expectedVersion, intent }) {
    return this.#enqueue(roomCode, () => {
      const room = this.#room(roomCode);
      this.#requireMember(room, userId);
      if (room.version !== expectedVersion) {
        throw onlineError("STALE_VERSION", "La sala cambió; actualiza el estado.", {
          expectedVersion,
          currentVersion: room.version,
        });
      }
      if (intent?.type === ONLINE_INTENTS.START_MATCH) {
        this.#startMatch(room, userId, intent.mode);
      } else {
        this.#applyHumanIntent(room, userId, intent);
      }
      this.#runCpuTurns(room);
      return this.#view(room, userId);
    });
  }

  getView({ roomCode, userId }) {
    const room = this.#room(roomCode);
    this.#requireMember(room, userId);
    return this.#view(room, userId);
  }

  disconnect({ roomCode, userId }) {
    const room = this.#room(roomCode);
    const seat = room.seats.find((candidate) => candidate.userId === userId);
    if (!seat) throw onlineError("NOT_ROOM_MEMBER", "El usuario no pertenece a la sala.");
    seat.connectionState = "DISCONNECTED";
    this.#advanceVersion(room);
  }

  reconnect({ roomCode, userId }) {
    const room = this.#room(roomCode);
    const seat = room.seats.find((candidate) => candidate.userId === userId);
    if (!seat) throw onlineError("NOT_ROOM_MEMBER", "El usuario no pertenece a la sala.");
    seat.connectionState = "CONNECTED";
    this.#advanceVersion(room);
    return this.#view(room, userId);
  }

  subscribe(roomCode, listener) {
    if (typeof listener !== "function") throw new TypeError("listener debe ser función.");
    const listeners = this.listeners.get(roomCode) ?? new Set();
    listeners.add(listener);
    this.listeners.set(roomCode, listeners);
    return () => listeners.delete(listener);
  }

  #startMatch(room, userId, mode = ROUND_STRUCTURE_MODES.BRANCHED) {
    this.#requireHost(room, userId);
    if (room.status !== ROOM_STATES.LOBBY) {
      throw onlineError("ROOM_ALREADY_STARTED", "La sala ya comenzó.");
    }
    const unresolved = room.seats.filter((seat) =>
      seat.controlType === SEAT_CONTROL_TYPES.HUMAN &&
      (seat.userId === null || seat.connectionState !== "CONNECTED")
    );
    if (unresolved.length > 0) {
      throw onlineError("UNRESOLVED_SEATS", "Los cuatro asientos deben estar resueltos.");
    }
    const engineSeats = room.seats.map((seat) => createSeat({
      seatIndex: seat.seatIndex,
      controlType: seat.controlType,
      nick: seat.nick,
      connectionState: seat.connectionState,
    }));
    room.state = createMatch({
      ...participantsFromSeats(engineSeats),
      matchId: `online-${room.roomCode}-${room.version + 1}`,
      mode,
      randomSource: this.randomSourceFactory(),
    });
    room.initialState = structuredClone(room.state);
    room.startedAt = this.clock();
    room.status = ROOM_STATES.PLAYING;
    this.#advanceVersion(room);
  }

  #applyHumanIntent(room, userId, intent) {
    if (room.status !== ROOM_STATES.PLAYING || room.state?.phase !== "playing") {
      throw onlineError("MATCH_NOT_PLAYING", "La partida no está activa.");
    }
    const seat = room.seats.find((candidate) => candidate.userId === userId);
    if (seat.seatId !== room.state.currentPlayerId) {
      throw onlineError("OUT_OF_TURN", "No es el turno de este asiento.");
    }
    const action = getAvailableActions(room.state).find(
      (candidate) => actionMatchesIntent(candidate, intent ?? {}),
    );
    if (!action) {
      throw onlineError("ILLEGAL_ACTION", "La intención no corresponde a una acción legal.");
    }
    this.#applyAction(room, action);
  }

  #applyAction(room, action) {
    room.state = applyTurnAction(room.state, action);
    room.moves.push(structuredClone(room.state.history.at(-1)));
    if (room.state.phase === "finished") {
      room.status = ROOM_STATES.FINISHED;
      room.finishedAt = this.clock();
    }
    this.#advanceVersion(room);
  }

  #runCpuTurns(room) {
    while (room.status === ROOM_STATES.PLAYING) {
      const seat = room.seats.find(
        (candidate) => candidate.seatId === room.state.currentPlayerId,
      );
      if (seat?.controlType !== SEAT_CONTROL_TYPES.CPU) return;
      const action = this.cpuChooser(createCpuSeatView(room.state, seat.seatId));
      this.#applyAction(room, action);
    }
  }

  #view(room, userId) {
    const seat = room.seats.find((candidate) => candidate.userId === userId);
    const state = room.state;
    return structuredClone({
      room: {
        roomCode: room.roomCode,
        ownerUserId: room.ownerUserId,
        status: room.status,
        version: room.version,
        seats: room.seats,
        startedAt: room.startedAt,
        finishedAt: room.finishedAt,
      },
      publicMatch: createPublicOnlineState(state),
      privateMatch: state && seat
        ? createPrivateOnlineState(state, seat.seatId)
        : null,
    });
  }

  #advanceVersion(room) {
    room.version += 1;
    for (const listener of this.listeners.get(room.roomCode) ?? []) {
      listener({ roomCode: room.roomCode, version: room.version, status: room.status });
    }
  }

  #enqueue(roomCode, operation) {
    const room = this.#room(roomCode);
    const result = room.lock.then(operation, operation);
    room.lock = result.then(() => undefined, () => undefined);
    return result;
  }

  #room(roomCode) {
    const room = this.rooms.get(String(roomCode ?? "").toUpperCase());
    if (!room) throw onlineError("ROOM_NOT_FOUND", "La sala no existe.");
    return room;
  }

  #requireMember(room, userId) {
    if (!room.seats.some((seat) => seat.userId === userId)) {
      throw onlineError("NOT_ROOM_MEMBER", "El usuario no pertenece a la sala.");
    }
  }

  #requireHost(room, userId) {
    if (room.ownerUserId !== userId) {
      throw onlineError("HOST_REQUIRED", "Solo el anfitrión puede realizar esta acción.");
    }
  }

  #uniqueRoomCode() {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const code = String(this.roomCodeFactory()).toUpperCase();
      if (/^[A-Z0-9]{5,8}$/.test(code) && !this.rooms.has(code)) return code;
    }
    throw onlineError("ROOM_CODE_EXHAUSTED", "No se pudo crear un código de sala.");
  }
}
