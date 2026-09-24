import {
  chooseCpuAction,
  createCpuSeatView,
  createMatch,
  createMatchRecord,
  participantsFromSeats,
  ROUND_STRUCTURE_MODES,
  SEAT_CONTROL_TYPES,
  seatForPlayerId,
  seatsFromParticipants,
  validateSeats,
  validateRoundStructureMode,
} from "../game/index.js";
import { InteractionController } from "./InteractionController.js";
import {
  BOARD_VIEW_MODES,
  ViewModeController,
} from "./ViewModeController.js";

export const LOCAL_GAME_SCREENS = Object.freeze({
  CONFIGURATION: "configuration",
  ROUND: "round",
});

const VALID_INITIAL_MODES = new Set(Object.values(BOARD_VIEW_MODES));
function validateViewMode(mode) {
  if (!VALID_INITIAL_MODES.has(mode)) {
    throw new TypeError(`Modo visual desconocido: ${String(mode)}.`);
  }
  return mode;
}

/**
 * Coordina la pantalla inicial y una sola ronda independiente.
 * No acumula partidas ni agrega estado al snapshot reglamentario.
 */
export class LocalGameSessionController {
  constructor({
    participants,
    seats,
    createRound = createMatch,
    randomSourceFactory = () => Math.random,
    requestAction,
    onChange = () => {},
    chooseCpuMove = chooseCpuAction,
    scheduleCpuTask = (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    cancelCpuTask = (handle) => globalThis.clearTimeout(handle),
    cpuTurnDelayMs = 850,
    historyStore = null,
    now = () => new Date().toISOString(),
    initialRoundMode = ROUND_STRUCTURE_MODES.BRANCHED,
    initialViewMode = BOARD_VIEW_MODES.TRADITIONAL,
  } = {}) {
    if ((!participants || typeof participants !== "object") && !Array.isArray(seats)) {
      throw new TypeError("participants o seats debe describir la mesa local.");
    }
    if (
      typeof createRound !== "function" ||
      typeof randomSourceFactory !== "function" ||
      typeof onChange !== "function"
    ) {
      throw new TypeError(
        "createRound, randomSourceFactory y onChange deben ser funciones.",
      );
    }
    if (requestAction !== undefined && typeof requestAction !== "function") {
      throw new TypeError("requestAction debe ser una función cuando se provee.");
    }

    if (
      typeof chooseCpuMove !== "function" ||
      typeof scheduleCpuTask !== "function" ||
      typeof cancelCpuTask !== "function" ||
      typeof now !== "function"
    ) {
      throw new TypeError("La orquestación local requiere funciones válidas.");
    }
    if (typeof cpuTurnDelayMs !== "number" && typeof cpuTurnDelayMs !== "function") {
      throw new TypeError("cpuTurnDelayMs debe ser número o función.");
    }

    this.seats = validateSeats(seats ?? seatsFromParticipants(participants));
    this.createRound = createRound;
    this.randomSourceFactory = randomSourceFactory;
    this.requestAction = requestAction;
    this.onChange = onChange;
    this.chooseCpuMove = chooseCpuMove;
    this.scheduleCpuTask = scheduleCpuTask;
    this.cancelCpuTask = cancelCpuTask;
    this.cpuTurnDelayMs = cpuTurnDelayMs;
    this.historyStore = historyStore;
    this.now = now;
    this.screen = LOCAL_GAME_SCREENS.CONFIGURATION;
    this.config = {
      roundMode: validateRoundStructureMode(initialRoundMode),
      initialViewMode: validateViewMode(initialViewMode),
    };
    this.roundController = null;
    this.roundSerial = 0;
    this.initialRoundState = null;
    this.startedAt = null;
    this.archivedMatchId = null;
    this.pendingCpuTask = null;
    this.handRevealedForPlayerId = null;
    this.viewModeController = new ViewModeController({
      initialMode: this.config.initialViewMode,
      onChange: () => this.#emitChange(),
    });
  }

  start() {
    this.#emitChange();
  }

  // Explicit UI exit: no active-round persistence exists. Keep configuration,
  // but stop the abandoned local controller and never let it render off-screen.
  leaveRound() {
    this.#cancelPendingCpuTask();
    this.roundController = null;
    this.handRevealedForPlayerId = null;
    this.screen = LOCAL_GAME_SCREENS.CONFIGURATION;
  }

  getPresentation() {
    const round = this.roundController?.getPresentation() ?? null;
    return {
      screen: this.screen,
      config: { ...this.config },
      viewMode: this.viewModeController.getMode(),
      seats: structuredClone(this.seats),
      round: round === null ? null : this.#protectRoundPresentation(round),
    };
  }

  getRoundState() {
    return this.roundController?.getState() ?? null;
  }

  setRoundMode(mode) {
    this.#requireConfiguration();
    this.config.roundMode = validateRoundStructureMode(mode);
    this.#emitChange();
    return this.config.roundMode;
  }

  setInitialViewMode(mode) {
    this.#requireConfiguration();
    this.config.initialViewMode = validateViewMode(mode);
    this.#emitChange();
    return this.config.initialViewMode;
  }

  setSeats(seats) {
    this.#requireConfiguration();
    this.seats = validateSeats(seats);
    this.#emitChange();
    return structuredClone(this.seats);
  }

  startNewGame() {
    this.#requireConfiguration();
    this.viewModeController.setMode(this.config.initialViewMode);
    return this.#createIndependentRound();
  }

  playAgain() {
    this.#requireFinishedRound();
    return this.#createIndependentRound();
  }

  changeConfiguration() {
    this.#requireFinishedRound();
    this.config.initialViewMode = this.viewModeController.getMode();
    this.roundController = null;
    this.#cancelPendingCpuTask();
    this.handRevealedForPlayerId = null;
    this.screen = LOCAL_GAME_SCREENS.CONFIGURATION;
    this.#emitChange();
  }

  setViewMode(mode) {
    this.#requireRound();
    return this.viewModeController.setMode(mode);
  }

  revealCurrentHand() {
    const round = this.#requireRound();
    const state = round.getState();
    if (state.phase === "finished") {
      throw new Error("La ronda ya terminó.");
    }
    if (this.#currentSeat(state).controlType === SEAT_CONTROL_TYPES.CPU) {
      throw new Error("La mano de la CPU permanece privada.");
    }
    this.handRevealedForPlayerId = state.currentPlayerId;
    this.#emitChange();
    return state.currentPlayerId;
  }

  selectDomino(dominoId) {
    this.#requireRevealedHand();
    return this.#requireRound().selectDomino(dominoId);
  }

  inspectPlacement(placementId) {
    return this.#requireRound().inspectPlacement(placementId);
  }

  inspectStructure(structureId) {
    return this.#requireRound().inspectStructure(structureId);
  }

  clearInspection() {
    return this.#requireRound().clearInspection();
  }

  submitTarget(target) {
    this.#requireRevealedHand();
    return this.#requireRound().submitTarget(target);
  }

  pass() {
    this.#requireRevealedHand();
    return this.#requireRound().pass();
  }

  #createIndependentRound() {
    const randomSource = this.randomSourceFactory();
    if (typeof randomSource !== "function") {
      throw new TypeError("randomSourceFactory debe devolver una función.");
    }
    this.roundSerial += 1;
    const initialState = this.createRound({
      ...participantsFromSeats(this.seats),
      matchId: `local-game-${this.roundSerial}`,
      mode: this.config.roundMode,
      randomSource,
    });
    const controllerOptions = {
      initialState,
      onChange: () => this.#handleRoundChange(),
    };
    if (this.requestAction !== undefined) {
      controllerOptions.requestAction = this.requestAction;
    }
    this.roundController = new InteractionController(controllerOptions);
    this.initialRoundState = structuredClone(initialState);
    this.startedAt = this.now();
    this.archivedMatchId = null;
    this.handRevealedForPlayerId = null;
    this.screen = LOCAL_GAME_SCREENS.ROUND;
    this.roundController.start();
    return initialState;
  }

  #requireConfiguration() {
    if (this.screen !== LOCAL_GAME_SCREENS.CONFIGURATION) {
      throw new Error("La configuración solo puede cambiarse en la pantalla inicial.");
    }
  }

  #requireRound() {
    if (
      this.screen !== LOCAL_GAME_SCREENS.ROUND ||
      this.roundController === null
    ) {
      throw new Error("No hay una partida activa.");
    }
    return this.roundController;
  }

  #requireFinishedRound() {
    const round = this.#requireRound();
    if (round.getState().phase !== "finished") {
      throw new Error("La partida todavía no ha terminado.");
    }
    return round;
  }

  #requireRevealedHand() {
    const state = this.#requireRound().getState();
    if (this.handRevealedForPlayerId !== state.currentPlayerId) {
      throw new Error("Muestra la mano del jugador actual antes de actuar.");
    }
  }

  #handleRoundChange() {
    const state = this.roundController?.getState();
    if (
      state &&
      (state.phase === "finished" ||
        this.handRevealedForPlayerId !== state.currentPlayerId)
    ) {
      this.handRevealedForPlayerId = null;
    }
    this.#archiveFinishedRound(state);
    this.#emitChange();
    this.#scheduleCpuTurn(state);
  }

  #protectRoundPresentation(round) {
    const state = this.roundController.getState();
    const isFinished = state.phase === "finished";
    const isRevealed =
      !isFinished && this.handRevealedForPlayerId === state.currentPlayerId;
    const current = round.view.participants.players.find(
      (player) => player.playerId === state.currentPlayerId,
    );
    const currentSeat = this.#currentSeat(state);
    const protectView = (view) => isRevealed
      ? view
      : {
          ...view,
          hand: [],
          legalPlays: [],
        };

    return {
      ...round,
      view: protectView(round.view),
      portView: protectView(round.portView),
      traditionalView: protectView(round.traditionalView),
      selectedDominoId: isRevealed ? round.selectedDominoId : null,
      selectedLegalTargets: isRevealed ? round.selectedLegalTargets : [],
      strategicDecisionGroups: isRevealed
        ? round.strategicDecisionGroups
        : [],
      canPass: isRevealed ? round.canPass : false,
      handPrivacy: {
        isRevealed,
        canReveal: !isFinished && currentSeat.controlType === SEAT_CONTROL_TYPES.HUMAN,
        controlType: currentSeat.controlType,
        isCpu: currentSeat.controlType === SEAT_CONTROL_TYPES.CPU,
        playerId: state.currentPlayerId,
        displayName: current?.displayName ?? state.currentPlayerId,
      },
    };
  }

  #emitChange() {
    this.onChange(this.getPresentation());
  }

  #currentSeat(state) {
    const seat = seatForPlayerId(this.seats, state.currentPlayerId);
    if (!seat) throw new Error("El turno no corresponde a un asiento local.");
    return seat;
  }

  #scheduleCpuTurn(state) {
    this.#cancelPendingCpuTask();
    if (!state || state.phase !== "playing") return;
    const seat = this.#currentSeat(state);
    if (seat.controlType !== SEAT_CONTROL_TYPES.CPU) return;
    const expectedTurn = state.turnNumber;
    const delay = typeof this.cpuTurnDelayMs === "function"
      ? this.cpuTurnDelayMs({ state, seat })
      : this.cpuTurnDelayMs;
    this.pendingCpuTask = this.scheduleCpuTask(() => {
      this.pendingCpuTask = null;
      const latest = this.roundController?.getState();
      if (
        !latest || latest.phase !== "playing" ||
        latest.turnNumber !== expectedTurn ||
        latest.currentPlayerId !== seat.seatId
      ) return;
      const cpuView = createCpuSeatView(latest, seat.seatId);
      const action = this.chooseCpuMove(cpuView);
      this.roundController.submitAction(action);
    }, Math.max(0, Number(delay) || 0));
  }

  #cancelPendingCpuTask() {
    if (this.pendingCpuTask !== null) {
      this.cancelCpuTask(this.pendingCpuTask);
      this.pendingCpuTask = null;
    }
  }

  #archiveFinishedRound(state) {
    if (
      !state || state.phase !== "finished" ||
      state.matchId === this.archivedMatchId
    ) return;
    const record = createMatchRecord({
      initialState: this.initialRoundState,
      finalState: state,
      seats: this.seats,
      startedAt: this.startedAt,
      finishedAt: this.now(),
    });
    this.historyStore?.save(record);
    this.archivedMatchId = state.matchId;
  }
}
