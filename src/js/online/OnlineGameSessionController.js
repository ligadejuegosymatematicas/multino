import { ROUND_STRUCTURE_MODES } from "../game/index.js";
import { BOARD_VIEW_MODES } from "../ui/ViewModeController.js";

export const ONLINE_SCREENS = Object.freeze({
  JOIN: "join",
  LOBBY: "lobby",
  ROUND: "round",
});

function normalizeRoomCode(value) {
  return String(value ?? "").trim().toUpperCase();
}

function targetsMatch(first, second) {
  if (first?.kind === "START") return true;
  if (first?.kind !== "OPEN_END" || second?.kind === "START") return false;
  return first.placementId === second?.placementId &&
    first?.portId === second?.portId;
}

function getSelectedTargets(privateMatch, dominoId) {
  if (!dominoId) return [];
  return privateMatch?.render?.graph?.legalPlays?.find(
    (play) => play.dominoId === dominoId,
  )?.legalTargets ?? [];
}

function getCurrentDisplayName(view) {
  return view?.participants?.players?.find((player) => player.isCurrentPlayer)
    ?.displayName ?? "Jugador";
}

export function createOnlineRoundPresentation({
  match,
  selectedDominoId = null,
  inspectedStructureId = null,
  inspectedPlacementId = null,
} = {}) {
  const privateMatch = match?.privateMatch;
  const publicMatch = match?.publicMatch;
  if (!privateMatch?.render || !publicMatch) return null;
  const ownTurn = publicMatch.phase === "playing" &&
    publicMatch.currentPlayerId === privateMatch.seatId;
  const selectedLegalTargets = ownTurn
    ? getSelectedTargets(privateMatch, selectedDominoId)
    : [];
  return {
    view: privateMatch.render.graph,
    portView: privateMatch.render.ports,
    traditionalView: privateMatch.render.traditional,
    selectedDominoId: ownTurn ? selectedDominoId : null,
    selectedLegalTargets,
    strategicDecisionGroups: [],
    inspectedStructureId,
    inspectedPlacementId,
    canPass: ownTurn && privateMatch.legalActions.some(
      (action) => action.type === "PASS",
    ),
    isFinished: publicMatch.phase === "finished",
    sessionKind: "ONLINE",
    handPrivacy: {
      isRevealed: true,
      alwaysVisible: true,
      canAct: ownTurn,
      canReveal: false,
      isCpu: false,
      playerId: privateMatch.seatId,
      displayName: getCurrentDisplayName(privateMatch.render.graph),
    },
  };
}

export class OnlineGameSessionController {
  constructor({ gateway, onChange = () => {} } = {}) {
    if (!gateway || typeof gateway.sendLobbyIntent !== "function") {
      throw new TypeError("Se requiere un gateway online.");
    }
    this.gateway = gateway;
    this.onChange = onChange;
    this.screen = ONLINE_SCREENS.JOIN;
    this.user = null;
    this.room = null;
    this.match = null;
    this.pendingRoomCode = "";
    this.viewMode = BOARD_VIEW_MODES.TRADITIONAL;
    this.selectedDominoId = null;
    this.inspectedStructureId = null;
    this.inspectedPlacementId = null;
    this.unsubscribe = null;
    this.refreshPromise = null;
  }

  async start({ roomCode = "" } = {}) {
    this.user = await this.gateway.ensureAnonymousIdentity();
    this.pendingRoomCode = normalizeRoomCode(roomCode);
    if (this.pendingRoomCode) {
      try {
        await this.resumeRoom(this.pendingRoomCode);
      } catch {
        this.screen = ONLINE_SCREENS.JOIN;
        this.#emitChange();
      }
    } else {
      this.#emitChange();
    }
  }

  getPresentation() {
    const seats = (this.room?.room_seats ?? []).map((seat) => ({
      seatId: seat.id,
      seatIndex: seat.seat_index,
      teamId: seat.team_id,
      controlType: seat.control_type,
      userId: seat.user_id,
      nick: seat.nick,
      connectionState: seat.connection_state,
    })).sort((first, second) => first.seatIndex - second.seatIndex);
    return {
      screen: this.screen,
      room: this.room
        ? {
            id: this.room.id,
            roomCode: this.room.code,
            ownerUserId: this.room.host_user_id,
            status: this.room.status,
            version: this.room.version,
            seats,
          }
        : null,
      userId: this.user?.id ?? null,
      pendingRoomCode: this.pendingRoomCode,
      viewMode: this.viewMode,
      config: { roundMode: ROUND_STRUCTURE_MODES.BRANCHED },
      round: createOnlineRoundPresentation({
        match: this.match,
        selectedDominoId: this.selectedDominoId,
        inspectedStructureId: this.inspectedStructureId,
        inspectedPlacementId: this.inspectedPlacementId,
      }),
    };
  }

  async createRoom(nick) {
    this.room = await this.gateway.sendLobbyIntent({
      type: "CREATE_ROOM",
      nick,
    });
    this.pendingRoomCode = this.room.code;
    await this.#enterRoom();
  }

  async joinRoom({ roomCode = this.pendingRoomCode, nick }) {
    const code = normalizeRoomCode(roomCode);
    this.room = await this.gateway.sendLobbyIntent({
      type: "JOIN_ROOM",
      roomCode: code,
      nick,
    });
    this.pendingRoomCode = code;
    await this.#enterRoom();
  }

  async resumeRoom(roomCode = this.pendingRoomCode) {
    const code = normalizeRoomCode(roomCode);
    this.room = await this.gateway.sendLobbyIntent({
      type: "GET_ROOM",
      roomCode: code,
    });
    this.pendingRoomCode = code;
    await this.#enterRoom();
  }

  async setSeatControl(seatIndex, controlType) {
    this.room = await this.gateway.sendLobbyIntent({
      type: "SET_SEAT_CONTROL",
      roomCode: this.room.code,
      seatIndex,
      controlType,
    });
    this.#emitChange();
  }

  async startMatch(mode = ROUND_STRUCTURE_MODES.BRANCHED) {
    this.match = await this.gateway.sendIntent({
      roomCode: this.room.code,
      expectedVersion: this.room.version,
      intent: { type: "START_MATCH", mode },
    });
    this.room = { ...this.room, status: "PLAYING" };
    this.screen = ONLINE_SCREENS.ROUND;
    this.#emitChange();
  }

  setViewMode(mode) {
    if (!Object.values(BOARD_VIEW_MODES).includes(mode)) {
      throw new TypeError(`Modo visual desconocido: ${String(mode)}.`);
    }
    this.viewMode = mode;
    this.#emitChange();
  }

  selectDomino(dominoId) {
    const round = this.getPresentation().round;
    if (!round?.handPrivacy.canAct) {
      throw new Error("Espera tu turno.");
    }
    if (!round.view.hand.some((domino) => domino.dominoId === dominoId)) {
      throw new Error("La ficha no pertenece a tu mano.");
    }
    this.selectedDominoId = this.selectedDominoId === dominoId
      ? null
      : dominoId;
    this.#emitChange();
  }

  async submitTarget(target) {
    if (!this.selectedDominoId) throw new Error("Selecciona una ficha.");
    const action = this.match.privateMatch.legalActions.find((candidate) =>
      candidate.type === "PLAY_DOMINO" &&
      candidate.dominoId === this.selectedDominoId &&
      targetsMatch(candidate.target, target)
    );
    if (!action) throw new Error("Ese lugar ya no está disponible.");
    await this.#sendGameIntent({
      type: "PLAY_TILE",
      dominoId: action.dominoId,
      target: action.target,
    });
  }

  async pass() {
    if (!this.match.privateMatch.legalActions.some(
      (action) => action.type === "PASS",
    )) {
      throw new Error("PASS no está disponible.");
    }
    await this.#sendGameIntent({ type: "PASS" });
  }

  inspectPlacement(placementId) {
    this.inspectedPlacementId = this.inspectedPlacementId === placementId
      ? null
      : placementId;
    this.#emitChange();
  }

  inspectStructure(structureId) {
    this.inspectedStructureId = this.inspectedStructureId === structureId
      ? null
      : structureId;
    this.#emitChange();
  }

  clearInspection() {
    this.inspectedStructureId = null;
    this.inspectedPlacementId = null;
    this.#emitChange();
  }

  async refresh() {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.#refreshNow().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  dispose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  async #enterRoom() {
    this.unsubscribe?.();
    this.unsubscribe = this.gateway.subscribeRoom(
      this.room.id,
      () => void this.refresh(),
    );
    if (this.room.status === "PLAYING" || this.room.status === "FINISHED") {
      this.match = await this.gateway.syncMatch(this.room.code);
      this.screen = ONLINE_SCREENS.ROUND;
    } else {
      this.screen = ONLINE_SCREENS.LOBBY;
    }
    this.#emitChange();
  }

  async #refreshNow() {
    if (!this.room) return;
    const room = await this.gateway.sendLobbyIntent({
      type: "GET_ROOM",
      roomCode: this.room.code,
    });
    this.room = room;
    if (room.status === "PLAYING" || room.status === "FINISHED") {
      this.match = await this.gateway.syncMatch(room.code);
      this.selectedDominoId = null;
      this.screen = ONLINE_SCREENS.ROUND;
    }
    this.#emitChange();
  }

  async #sendGameIntent(intent) {
    this.match = await this.gateway.sendIntent({
      roomCode: this.room.code,
      expectedVersion: this.match.version,
      intent,
    });
    this.selectedDominoId = null;
    this.#emitChange();
  }

  #emitChange() {
    this.onChange(this.getPresentation());
  }
}
