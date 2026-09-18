import {
  createMatch,
  ROUND_STRUCTURE_MODES,
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
    createRound = createMatch,
    randomSourceFactory = () => Math.random,
    requestAction,
    onChange = () => {},
    initialRoundMode = ROUND_STRUCTURE_MODES.BRANCHED,
    initialViewMode = BOARD_VIEW_MODES.TRADITIONAL,
  } = {}) {
    if (!participants || typeof participants !== "object") {
      throw new TypeError("participants debe describir la mesa local.");
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

    this.participants = participants;
    this.createRound = createRound;
    this.randomSourceFactory = randomSourceFactory;
    this.requestAction = requestAction;
    this.onChange = onChange;
    this.screen = LOCAL_GAME_SCREENS.CONFIGURATION;
    this.config = {
      roundMode: validateRoundStructureMode(initialRoundMode),
      initialViewMode: validateViewMode(initialViewMode),
    };
    this.roundController = null;
    this.roundSerial = 0;
    this.handRevealedForPlayerId = null;
    this.viewModeController = new ViewModeController({
      initialMode: this.config.initialViewMode,
      onChange: () => this.#emitChange(),
    });
  }

  start() {
    this.#emitChange();
  }

  getPresentation() {
    const round = this.roundController?.getPresentation() ?? null;
    return {
      screen: this.screen,
      config: { ...this.config },
      viewMode: this.viewModeController.getMode(),
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
      ...this.participants,
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
    this.#emitChange();
  }

  #protectRoundPresentation(round) {
    const state = this.roundController.getState();
    const isFinished = state.phase === "finished";
    const isRevealed =
      !isFinished && this.handRevealedForPlayerId === state.currentPlayerId;
    const current = round.view.participants.players.find(
      (player) => player.playerId === state.currentPlayerId,
    );
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
        playerId: state.currentPlayerId,
        displayName: current?.displayName ?? state.currentPlayerId,
      },
    };
  }

  #emitChange() {
    this.onChange(this.getPresentation());
  }
}
