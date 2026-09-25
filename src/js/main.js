import {
  GraphRenderer,
  PortRenderer,
  TraditionalRenderer,
} from "./ui/BoardRenderer.js";
import { renderHand, renderTurnAction } from "./ui/HandRenderer.js";
import {
  getGameFeedback,
  renderGameFeedback,
  SCORING_FEEDBACK_TIMING,
} from "./ui/GameFeedback.js";
import {
  LOCAL_GAME_SCREENS,
  LocalGameSessionController,
} from "./ui/LocalGameSessionController.js";
import {
  renderRoundResult,
  renderScorePanel,
  renderCurrentSum,
  shouldDeferRoundResult,
  getRoundActionsPresentation,
} from "./ui/ScorePanel.js";
import {
  renderTurnPanel,
} from "./ui/TurnIndicator.js";
import {
  BOARD_VIEW_MODES,
} from "./ui/ViewModeController.js";
import {
  createDefaultSeats,
  createSeat,
  ROUND_STRUCTURE_MODES,
  SEAT_CONTROL_TYPES,
} from "./game/index.js";
import { APP_NAME } from "./config/AppConfig.js";
import { observeBrandPresentation } from "./ui/BrandPresentation.js";
import { AppNavigation, getExitPrompt } from "./ui/AppNavigation.js";
import { getRuntimeConfig } from "./config/RuntimeConfig.js";
import {
  ONLINE_SCREENS,
  OnlineGameSessionController,
} from "./online/OnlineGameSessionController.js";
import { createBrowserGatewayProvider } from "./online/SupabaseBrowserClient.js";
import {
  LocalMatchHistoryStore,
  LocalOnlineRoomStore,
  LocalProfileStore,
} from "./storage/LocalStores.js";
import {
  getLocalCpuPresentationDelay,
  getOnlineIdleTurnMessage,
  getPresentedActivePlayerId,
  isPresentationBarrierActive,
  isDirectTerminalSync,
  resolvePresentedFeedback,
} from "./ui/PresentationBarrier.js";

const boardRoot = document.querySelector("#board-root");
const graphRenderer = new GraphRenderer(boardRoot);
const portRenderer = new PortRenderer(boardRoot);
const traditionalRenderer = new TraditionalRenderer(boardRoot);
const passButton = document.querySelector("#pass-action");
const message = document.querySelector("#game-message");
const boardHeading = document.querySelector("#board-heading");
const semanticLegend = document.querySelector("#board-semantic-legend");
const modeButtons = [...document.querySelectorAll("[data-view-mode]")];
const setupScreen = document.querySelector("#setup-screen");
const entryScreen = document.querySelector("#entry-screen");
const onlineScreen = document.querySelector("#online-screen");
const onlineCard = onlineScreen.querySelector(".online-card");
const onlineJoinForm = document.querySelector("#online-join-form");
const onlineLobby = document.querySelector("#online-lobby");
const onlineStatus = document.querySelector("#online-status");
const onlineNick = document.querySelector("#online-nick");
const onlineRoomCode = document.querySelector("#online-room-code");
const onlineRoomCodeValue = document.querySelector("#online-room-code-value");
const onlineSeatList = document.querySelector("#online-seat-list");
const onlineRoundMode = document.querySelector("#online-round-mode");
const startOnlineButton = document.querySelector("#start-online-game-action");
const gameScreen = document.querySelector("#game-screen");
const setupForm = document.querySelector("#setup-form");
const setupRoundMode = document.querySelector("#setup-round-mode");
const setupRoundModeHelp = document.querySelector("#setup-round-mode-help");
const seatConfigElements = [
  ...document.querySelectorAll("[data-seat-index]"),
];
const initialModeInputs = [
  ...document.querySelectorAll("[name='initial-view-mode']"),
];
const roundActions = document.querySelector("#round-actions");
const playAgainButton = document.querySelector("#play-again-action");
const changeConfigButton = document.querySelector("#change-config-action");
const sessionBadge = document.querySelector("#session-badge");
const playFeedback = document.querySelector("#play-feedback");
const appShell = document.querySelector(".app-shell");
const handPanel = document.querySelector("#hand-panel");
const handContent = document.querySelector("#hand-content");
const handPrivacy = document.querySelector("#hand-privacy");
const handPrivacyTitle = document.querySelector("#hand-privacy-title");
const revealHandButton = document.querySelector("#reveal-hand-action");
const turnActionPanel = document.querySelector("#turn-action-panel");
const turnActionSummary = document.querySelector("#turn-action-summary");
const currentSum = document.querySelector("#score-current-sum");
const gameBackButton = document.querySelector("#game-back-action");
const exitDialog = document.querySelector("#exit-dialog");
let sessionController;
let localSessionController = null;
let onlineSessionController = null;
let lastFeedbackSequence = null;
let feedbackHideTimer = null;
let feedbackHideSequence = null;
let onlinePresentationTimer = null;
let onlinePresentationTimerKey = null;
let activeFeedbackPresentation = null;
let roundResultPending = false;
let hasShownScoringLesson = false;
let navigationEpoch = 0;
const ROUND_RESULT_REVEAL_DELAY_MS = 520;
const ONLINE_CPU_ANNOUNCE_MS = 500;
const ONLINE_HUMAN_ANNOUNCE_MS = 80;
const ONLINE_MOVE_HOLD_MS = 800;
const ONLINE_POST_SCORE_PAUSE_MS = 260;
const profileStore = new LocalProfileStore();
const historyStore = new LocalMatchHistoryStore();
const onlineRoomStore = new LocalOnlineRoomStore();
const getOnlineGateway = createBrowserGatewayProvider();
document.title = APP_NAME;
observeBrandPresentation();
document.querySelector("#app-title").textContent = APP_NAME;
for (const element of document.querySelectorAll("[data-app-name]")) {
  element.textContent = APP_NAME;
}
for (const element of document.querySelectorAll("[data-app-name-alt]")) {
  element.alt = APP_NAME;
}
const runtimeConfig = getRuntimeConfig();
const initialUrlRoom = new URL(window.location.href).searchParams.get("room");
const navigation = new AppNavigation({
  history: window.history,
  location: window.location,
  events: window,
  getPrompt: () => getExitPrompt(sessionController?.getPresentation(),
    sessionController === onlineSessionController ? "online" : "local"),
  confirmExit: (text) => new Promise((resolve) => {
    document.querySelector("#exit-description").textContent = text;
    exitDialog.returnValue = "stay";
    exitDialog.addEventListener("close", () => resolve(exitDialog.returnValue === "exit"), { once: true });
    exitDialog.showModal();
  }),
  onRoute: navigateToScreen,
  exitRoute: (route) => route.screen === "online-round" ? { screen: "entry" } : null,
});
const restoredRoute = navigation.restoredRoute;
navigation.init();
document.querySelector("#online-availability").hidden = runtimeConfig.onlineEnabled;
document.querySelector("#online-availability").textContent = runtimeConfig.onlineEnabled
  ? "" : "El modo online aún no está configurado.";

function collectSetupSeats() {
  return seatConfigElements.map((element, seatIndex) => {
    const controlType = element.querySelector("[data-seat-control]").value;
    const nickInput = element.querySelector("[data-seat-nick]");
    return createSeat({
      seatIndex,
      controlType,
      nick: controlType === SEAT_CONTROL_TYPES.CPU
        ? `CPU ${seatIndex + 1}`
        : nickInput.value,
    });
  });
}

function renderSeatSetup(seats) {
  for (const seat of seats) {
    const element = seatConfigElements[seat.seatIndex];
    const control = element.querySelector("[data-seat-control]");
    const nick = element.querySelector("[data-seat-nick]");
    control.value = seat.controlType;
    nick.disabled = seat.controlType === SEAT_CONTROL_TYPES.CPU;
    if (document.activeElement !== nick) nick.value = seat.nick;
  }
}

function setMessage(text) {
  message.textContent = text;
}

function clearOnlinePresentationTimer() {
  if (onlinePresentationTimer !== null) {
    window.clearTimeout(onlinePresentationTimer);
  }
  onlinePresentationTimer = null;
  onlinePresentationTimerKey = null;
}

function resetPresentationBarrier() {
  if (feedbackHideTimer !== null) {
    window.clearTimeout(feedbackHideTimer);
  }
  feedbackHideTimer = null;
  feedbackHideSequence = null;
  activeFeedbackPresentation = null;
  roundResultPending = false;
  lastFeedbackSequence = null;
  renderGameFeedback(playFeedback, null);
}

function scheduleOnlinePresentationTimer(key, delay, callback) {
  if (onlinePresentationTimer !== null && onlinePresentationTimerKey === key) {
    return;
  }
  clearOnlinePresentationTimer();
  onlinePresentationTimerKey = key;
  onlinePresentationTimer = window.setTimeout(() => {
    onlinePresentationTimer = null;
    onlinePresentationTimerKey = null;
    callback();
  }, delay);
}

function completeQueuedOnlineMove(delay = ONLINE_POST_SCORE_PAUSE_MS) {
  if (onlineSessionController?.getPresentation().presentationQueue.phase !== "move") {
    return;
  }
  const sequence = onlineSessionController.getPresentation()
    .presentationQueue.presentedSequence;
  scheduleOnlinePresentationTimer(`complete:${sequence}`, delay, () => {
    onlineSessionController?.completePresentation();
  });
}

function finishFeedbackPresentation(feedback) {
  const session = sessionController?.getPresentation();
  if (!session?.round) {
    renderGameFeedback(playFeedback, null);
    feedbackHideTimer = null;
    feedbackHideSequence = null;
    activeFeedbackPresentation = null;
    return;
  }
  if (feedback?.scoring && feedback.endedRound) {
    // Primero desaparece el cálculo y se aplica visualmente el marcador.
    // El resultado final entra después de una pausa breve e independiente.
    activeFeedbackPresentation = null;
    roundResultPending = true;
    renderRound(session.round, session.viewMode, null, {
      revealRoundResult: false,
      interactionLocked: true,
    });
    feedbackHideTimer = window.setTimeout(() => {
      const latest = sessionController?.getPresentation();
      if (latest?.round) {
        roundResultPending = false;
        renderRound(latest.round, latest.viewMode, null);
      }
      feedbackHideTimer = null;
      feedbackHideSequence = null;
      completeQueuedOnlineMove();
    }, ROUND_RESULT_REVEAL_DELAY_MS);
    return;
  }
  activeFeedbackPresentation = null;
  renderRound(session.round, session.viewMode, null);
  feedbackHideTimer = null;
  feedbackHideSequence = null;
  completeQueuedOnlineMove();
}

function scheduleFeedbackHide(feedback) {
  if (
    feedbackHideTimer !== null &&
    feedback?.sequence === feedbackHideSequence
  ) {
    return;
  }
  if (feedbackHideTimer !== null && !roundResultPending) {
    window.clearTimeout(feedbackHideTimer);
    feedbackHideTimer = null;
    feedbackHideSequence = null;
  }
  if (!feedback?.message) {
    return;
  }
  if (feedback.scoring) activeFeedbackPresentation = feedback;
  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches ?? false;
  const duration = feedback.scoring
    ? reducedMotion
      ? SCORING_FEEDBACK_TIMING.reducedMotionMs
      : SCORING_FEEDBACK_TIMING.totalMs
      : 2100;
  feedbackHideSequence = feedback.sequence;
  feedbackHideTimer = window.setTimeout(() => {
    finishFeedbackPresentation(feedback);
  }, duration);
}

async function runIntent(intent, successMessage) {
  try {
    await intent();
    setMessage(successMessage);
  } catch (error) {
    setMessage(error.message);
  }
}

function describeStructure(presentation, structureId) {
  if (structureId === "main") {
    return "el recorrido inicial";
  }
  return presentation.view.topology.branchFamilies.some(
    (family) => family.id === structureId,
  ) ? "las ramas del doble central" : "el recorrido";
}

function inspectStructure(structureId) {
  const presentation = sessionController.getPresentation().round;
  const wasInspected = presentation.inspectedStructureId === structureId;
  runIntent(
    () => sessionController.inspectStructure(structureId),
    wasInspected
      ? "Detalle cerrado."
      : `Viendo ${describeStructure(presentation, structureId)}.`,
  );
}

function renderRound(
  presentation,
  mode,
  feedback,
  {
    revealRoundResult = true,
    interactionLocked = isPresentationBarrierActive({
      feedback,
      presentationQueue: presentation.presentationQueue,
      roundResultPending,
    }),
  } = {},
) {
  if (mode !== BOARD_VIEW_MODES.TRADITIONAL) {
    // El viewport tradicional será reemplazado por otro renderer. Capturamos
    // su cámara y desconectamos el observer antes de que el nodo quede suelto;
    // un callback tardío con tamaño 0 no puede provocar otro auto-fit.
    traditionalRenderer.deactivate();
  }
  const roundResultDeferred = shouldDeferRoundResult({
    isFinished: presentation.isFinished,
    feedback,
    revealRoundResult,
  });
  const renderer = mode === BOARD_VIEW_MODES.GRAPH
    ? graphRenderer
    : mode === BOARD_VIEW_MODES.PORTS
      ? portRenderer
      : traditionalRenderer;
  boardRoot.dataset.viewMode = mode;
  appShell.classList.toggle(
    "is-ports-mode",
    mode === BOARD_VIEW_MODES.PORTS,
  );
  boardRoot.classList.toggle(
    "is-traditional-view",
    mode === BOARD_VIEW_MODES.TRADITIONAL,
  );
  boardRoot.classList.toggle(
    "is-ports-view",
    mode === BOARD_VIEW_MODES.PORTS,
  );
  boardRoot.classList.toggle(
    "is-scoring-feedback",
    feedback?.scoring != null,
  );
  boardHeading.textContent = mode === BOARD_VIEW_MODES.GRAPH
    ? "Grafo de valores"
    : mode === BOARD_VIEW_MODES.PORTS
      ? "Estrategia"
      : "Mesa tradicional";
  semanticLegend.hidden = mode === BOARD_VIEW_MODES.TRADITIONAL;
  for (const button of modeButtons) {
    const isActive = button.dataset.viewMode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
    button.disabled = interactionLocked;
    button.setAttribute("aria-disabled", String(interactionLocked));
  }

  const visualPresentation = {
    ...presentation,
    scoringResolution: feedback?.scoring ?? null,
  };
  renderer.render(visualPresentation, {
    onTarget: (target) =>
      runIntent(() => sessionController.submitTarget(target), ""),
    onStart: (target) =>
      runIntent(
        () => sessionController.submitTarget(target),
        "",
      ),
    onInspectEdge: (edge) => {
      const presentation = sessionController.getPresentation().round;
      const structureId = edge.topology.familyId ?? "main";
      const wasInspected = presentation.inspectedStructureId === structureId;
      runIntent(
        () => sessionController.inspectPlacement(edge.placementId),
        wasInspected
          ? "Detalle cerrado."
          : `Viendo ${describeStructure(presentation, structureId)}.`,
      );
    },
    onInspectStructure: inspectStructure,
    onClearInspection: () =>
      runIntent(
        () => sessionController.clearInspection(),
        "Detalle cerrado.",
      ),
    onMessage: setMessage,
  });
  const handIsVisible = (presentation.handPrivacy.isRevealed ||
      presentation.handPrivacy.alwaysVisible) &&
    !presentation.isFinished;
  handPanel.hidden = presentation.isFinished;
  handContent.hidden = !handIsVisible;
  handPrivacy.hidden = handIsVisible || presentation.isFinished;
  handPrivacyTitle.textContent = interactionLocked
    ? "Puntuación en curso"
    : presentation.handPrivacy.isCpu
    ? `${presentation.handPrivacy.displayName} está pensando…`
    : `Turno de ${presentation.handPrivacy.displayName} · entrega el dispositivo`;
  const canReveal = presentation.handPrivacy.canReveal && !interactionLocked;
  revealHandButton.hidden = !canReveal;
  revealHandButton.disabled = !canReveal;
  if (handIsVisible) {
    renderHand(document.querySelector("#hand-root"), presentation, {
      disabled: interactionLocked,
      onSelect: (dominoId) =>
        runIntent(
          () => sessionController.selectDomino(dominoId),
          "",
        ),
    });
  } else {
    document.querySelector("#hand-root").replaceChildren();
  }
  const canAct = !interactionLocked &&
    (presentation.handPrivacy.canAct ?? handIsVisible);
  turnActionPanel.hidden = !canAct || presentation.isFinished;
  if (canAct) {
    renderTurnAction(turnActionSummary, presentation);
  } else {
    turnActionSummary.replaceChildren();
  }
  renderTurnPanel(
    document.querySelector("#turn-panel"),
    presentation.view,
    {
      emphasize: feedback !== null && !feedback.endedRound,
      activePlayerId: getPresentedActivePlayerId({
        isFinished: presentation.isFinished,
        roundResultDeferred,
        feedbackPlayerId: feedback?.playerId,
        presentationActorId: presentation.presentationQueue?.actorSeatId,
        currentPlayerId: presentation.view.turn.currentPlayerId,
      }),
    },
  );
  document.querySelector("#turn-panel").classList.toggle(
    "is-presenting-turn",
    presentation.presentationQueue?.phase === "announce",
  );
  renderScorePanel(
    document.querySelector("#score-panel"),
    presentation.view,
    { feedback },
  );
  renderCurrentSum(
    currentSum,
    presentation.view,
    { feedback },
  );
  renderRoundResult(
    document.querySelector("#round-result"),
    presentation.view,
    {
      deferred: roundResultDeferred,
    },
  );
  renderGameFeedback(playFeedback, feedback);

  passButton.disabled = interactionLocked || !presentation.canPass ||
    presentation.isFinished;
  passButton.hidden = !presentation.canPass || presentation.isFinished;
  const resultActions = getRoundActionsPresentation({
    isFinished: presentation.isFinished,
    deferred: roundResultDeferred,
    sessionKind: presentation.sessionKind,
  });
  roundActions.hidden = !resultActions.visible;
  playAgainButton.hidden = !resultActions.canPlayAgain;
  changeConfigButton.hidden = !resultActions.canConfigure;
  document.querySelector("#round-home-action").hidden = !resultActions.canGoHome;
  const resultNotice = document.querySelector("#round-actions-notice");
  resultNotice.textContent = resultActions.notice;
  resultNotice.hidden = !resultActions.notice;
  const selectedCount = presentation.selectedLegalTargets.length;
  const strategicDecisionCount = presentation.strategicDecisionGroups?.length ?? 0;
  const selectionHint = document.querySelector("#selection-hint");
  selectionHint.textContent = interactionLocked || presentation.isFinished ||
      !presentation.handPrivacy.isRevealed ||
      presentation.selectedDominoId === null
      ? ""
      : presentation.selectedLegalTargets.some((target) => target.kind === "START")
        ? ""
        : mode === BOARD_VIEW_MODES.PORTS && strategicDecisionCount > 1
          ? `${strategicDecisionCount} opciones`
        : mode === BOARD_VIEW_MODES.PORTS && selectedCount > 1
          ? `${selectedCount} opciones`
        : selectedCount > 1
          ? `${selectedCount} lugares`
          : "";
  selectionHint.hidden = selectionHint.textContent === "";
}

function renderSession(session) {
  const isConfiguring = session.screen === LOCAL_GAME_SCREENS.CONFIGURATION;
  entryScreen.hidden = true;
  onlineScreen.hidden = true;
  setupScreen.hidden = !isConfiguring;
  gameScreen.hidden = isConfiguring;
  appShell.classList.toggle("is-playing", !isConfiguring);
  gameBackButton.hidden = isConfiguring;
  gameBackButton.textContent = session.round?.isFinished ? "Volver" : "Salir";
  navigation.record({ screen: isConfiguring ? "local-setup" : "local-round" });
  setupRoundMode.value = session.config.roundMode;
  setupRoundModeHelp.textContent = session.config.roundMode ===
      ROUND_STRUCTURE_MODES.BRANCHED
    ? "En Ramificado, el primer doble jugado es el único que puede recibir hasta cuatro conexiones."
    : "En Lineal, la mesa forma una sola cadena y cada doble admite dos conexiones.";
  for (const input of initialModeInputs) {
    input.checked = input.value === session.config.initialViewMode;
  }
  sessionBadge.textContent = isConfiguring
    ? "Múltiplos de 5"
    : session.config.roundMode === ROUND_STRUCTURE_MODES.BRANCHED
      ? "Ramificado"
      : "Lineal";
  if (!isConfiguring) {
    const nextFeedback = getGameFeedback(session.round.view);
    let feedback = resolvePresentedFeedback({
      nextFeedback,
      lastFeedbackSequence,
      activeFeedback: activeFeedbackPresentation,
    });
    if (feedback?.scoring && !hasShownScoringLesson) {
      feedback = { ...feedback, showScoringLesson: true };
      hasShownScoringLesson = true;
    }
    renderRound(session.round, session.viewMode, feedback);
    scheduleFeedbackHide(feedback);
    lastFeedbackSequence = nextFeedback?.sequence ?? null;
  } else {
    renderSeatSetup(session.seats);
    lastFeedbackSequence = null;
    activeFeedbackPresentation = null;
    roundResultPending = false;
    renderGameFeedback(playFeedback, null);
    scheduleFeedbackHide(null);
  }
}

function renderOnlineLobby(session) {
  const room = session.room;
  onlineRoomCodeValue.textContent = room.roomCode;
  onlineSeatList.replaceChildren();
  const isHost = room.ownerUserId === session.userId;
  for (const seat of room.seats) {
    const item = document.createElement("li");
    item.className = "online-seat";
    item.classList.toggle("is-connected", seat.connectionState === "CONNECTED");
    item.classList.toggle("is-cpu", seat.controlType === "CPU");
    const identity = document.createElement("div");
    identity.className = "online-seat__identity";
    const title = document.createElement("strong");
    const isSelf = seat.userId === session.userId;
    title.textContent = `${seat.nick}${isSelf ? " · tú" : ""}`;
    const detail = document.createElement("small");
    detail.textContent = `Asiento ${seat.seatIndex + 1} · Equipo ${seat.teamId} · ${seat.controlType === "CPU" ? "CPU" : seat.connectionState === "CONNECTED" ? "conectado" : "libre"}`;
    identity.append(title, detail);
    item.append(identity);
    const mayToggle = isHost && (!seat.userId || isSelf) && seat.seatIndex !== 0;
    if (mayToggle) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "secondary-action";
      toggle.textContent = seat.controlType === "CPU" ? "Dejar libre" : "Usar CPU";
      toggle.addEventListener("click", () => void withOnlineBusy(() =>
        onlineSessionController.setSeatControl(
          seat.seatIndex,
          seat.controlType === "CPU" ? "HUMAN" : "CPU",
        )
      ));
      item.append(toggle);
    }
    onlineSeatList.append(item);
  }
  const allResolved = room.seats.length === 4 && room.seats.every((seat) =>
    seat.controlType === "CPU" || seat.connectionState === "CONNECTED"
  );
  startOnlineButton.hidden = !isHost;
  startOnlineButton.disabled = !allResolved;
  onlineStatus.textContent = isHost
    ? allResolved
      ? "La mesa está completa."
      : "Invita jugadores o completa los asientos libres con CPU."
    : "Esperando que el anfitrión complete la mesa.";
}

function renderOnlineSession(session) {
  entryScreen.hidden = true;
  setupScreen.hidden = true;
  const isRound = session.screen === ONLINE_SCREENS.ROUND && session.round;
  onlineScreen.hidden = isRound;
  gameScreen.hidden = !isRound;
  appShell.classList.toggle("is-playing", Boolean(isRound));
  gameBackButton.hidden = !isRound;
  gameBackButton.textContent = session.round?.isFinished ? "Volver" : "Salir";
  navigation.record({
    screen: isRound ? "online-round" : session.room ? "online-lobby" : "online-join",
    roomCode: session.room?.roomCode ?? session.pendingRoomCode,
  }, { replace: Boolean(isRound && navigation.current.route.screen.startsWith("online-")) });
  if (isRound) {
    sessionBadge.textContent = `Online · ${session.room.roomCode}`;
    const queue = session.presentationQueue;
    if (queue.phase === "announce") {
      renderRound(session.round, session.viewMode, null);
      scheduleFeedbackHide(null);
      const actorName = queue.actorName ?? "Jugador";
      setMessage(
        queue.actorControlType === "CPU"
          ? `${actorName} está jugando…`
          : `Turno de ${actorName}`,
      );
      const delay = queue.actorControlType === "CPU"
        ? ONLINE_CPU_ANNOUNCE_MS
        : ONLINE_HUMAN_ANNOUNCE_MS;
      scheduleOnlinePresentationTimer(
        `announce:${queue.presentedSequence}:${queue.actorSeatId}`,
        delay,
        () => onlineSessionController?.advancePresentation(),
      );
      return;
    }
    const nextFeedback = getGameFeedback(session.round.view);
    const directTerminalSync = isDirectTerminalSync({
      isFinished: session.round.isFinished,
      presentationPhase: queue.phase,
      lastFeedbackSequence,
      activeFeedback: activeFeedbackPresentation,
    });
    let feedback = directTerminalSync
      ? null
      : resolvePresentedFeedback({
        nextFeedback,
        lastFeedbackSequence,
        activeFeedback: activeFeedbackPresentation,
      });
    if (feedback?.scoring && !hasShownScoringLesson) {
      feedback = { ...feedback, showScoringLesson: true };
      hasShownScoringLesson = true;
    }
    renderRound(session.round, session.viewMode, feedback, {
      revealRoundResult: !roundResultPending,
    });
    if (queue.phase === "idle") {
      setMessage(getOnlineIdleTurnMessage({
        isFinished: session.round.isFinished,
        currentPlayerId: session.round.view.turn.currentPlayerId,
        players: session.round.view.participants.players,
        seats: session.room.seats,
      }));
    }
    if (roundResultPending) {
      lastFeedbackSequence = nextFeedback?.sequence ?? null;
      return;
    }
    if (queue.phase === "move" && !feedback?.scoring) {
      scheduleFeedbackHide(null);
      scheduleOnlinePresentationTimer(
        `move:${queue.presentedSequence}`,
        ONLINE_MOVE_HOLD_MS,
        () => onlineSessionController?.completePresentation(),
      );
    } else {
      clearOnlinePresentationTimer();
      scheduleFeedbackHide(feedback);
    }
    lastFeedbackSequence = nextFeedback?.sequence ?? null;
    return;
  }
  sessionBadge.textContent = session.room
    ? `Sala ${session.room.roomCode}`
    : "Online";
  onlineScreen.hidden = false;
  const isLobby = session.screen === ONLINE_SCREENS.LOBBY && session.room;
  onlineJoinForm.hidden = isLobby;
  onlineLobby.hidden = !isLobby;
  if (isLobby) renderOnlineLobby(session);
  else {
    onlineRoomCode.value = session.pendingRoomCode;
    const savedRoomCode = onlineRoomStore.load().roomCode;
    const resumeButton = document.querySelector("#resume-room-action");
    resumeButton.hidden = !savedRoomCode;
    resumeButton.textContent = `Volver a mi sala ${savedRoomCode}`;
    onlineStatus.textContent = session.pendingRoomCode
      ? `Escribe tu nombre para unirte a ${session.pendingRoomCode}.`
      : "Crea una sala privada o únete con un código.";
  }
}

function startLocalMode() {
  navigationEpoch += 1;
  clearOnlinePresentationTimer();
  resetPresentationBarrier();
  onlineSessionController?.dispose();
  onlineSessionController = null;
  if (!localSessionController) {
    const savedProfile = profileStore.load();
    localSessionController = new LocalGameSessionController({
      seats: createDefaultSeats({
        humanCount: 1,
        nick: savedProfile.nick || "Jugador 1",
      }),
      historyStore,
      cpuTurnDelayMs: ({ state }) => getLocalCpuPresentationDelay({
        state,
        scoringDurationMs: SCORING_FEEDBACK_TIMING.totalMs,
      }),
      onChange: (session) => {
        if (sessionController === localSessionController) renderSession(session);
      },
    });
  }
  sessionController = localSessionController;
  sessionController.start();
}

async function startOnlineMode(roomCode = "", { resumeSaved = true, recordEntry = true, joinOnly = false } = {}) {
  const epoch = ++navigationEpoch;
  clearOnlinePresentationTimer();
  resetPresentationBarrier();
  if (!runtimeConfig.onlineEnabled) {
    onlineStatus.textContent = "El modo online aún no está configurado.";
    return;
  }
  entryScreen.hidden = true;
  setupScreen.hidden = true;
  gameScreen.hidden = true;
  onlineScreen.hidden = false;
  gameBackButton.hidden = true;
  appShell.classList.remove("is-playing", "is-ports-mode");
  if (recordEntry) navigation.record({ screen: "online-join", roomCode });
  onlineCard.classList.add("is-busy");
  onlineStatus.textContent = "Conectando con la sala…";
  try {
    const activeRoomCode = roomCode || (resumeSaved ? onlineRoomStore.load().roomCode : "");
    const gateway = await getOnlineGateway();
    if (epoch !== navigationEpoch) return;
    onlineSessionController?.dispose();
    onlineSessionController = new OnlineGameSessionController({
      gateway,
      onChange: (session) => {
        if (epoch === navigationEpoch) renderOnlineSession(joinOnly && session.screen === ONLINE_SCREENS.JOIN
          ? { ...session, pendingRoomCode: roomCode } : session);
      },
      onError: (error) => {
        if (epoch === navigationEpoch) onlineStatus.textContent = error.message;
      },
      onResync: () => {
        if (epoch !== navigationEpoch) return;
        clearOnlinePresentationTimer();
        resetPresentationBarrier();
      },
    });
    sessionController = onlineSessionController;
    const controller = onlineSessionController;
    await controller.start({ roomCode: joinOnly ? "" : activeRoomCode });
    if (epoch !== navigationEpoch) { controller.dispose(); return; }
    const resumedRoomCode = controller.getPresentation().room?.roomCode;
    if (resumedRoomCode) onlineRoomStore.save({ roomCode: resumedRoomCode });
  } catch (error) {
    if (epoch === navigationEpoch) onlineStatus.textContent = error.message;
  } finally {
    if (epoch === navigationEpoch) onlineCard.classList.remove("is-busy");
  }
}

async function withOnlineBusy(operation) {
  onlineCard.classList.add("is-busy");
  try {
    await operation();
  } catch (error) {
    onlineStatus.textContent = error.message;
  } finally {
    onlineCard.classList.remove("is-busy");
  }
}

function showEntry() {
  navigationEpoch += 1;
  clearOnlinePresentationTimer();
  resetPresentationBarrier();
  onlineSessionController?.dispose();
  onlineSessionController = null;
  sessionController = null;
  // Leaving the screen is not leaving the room. Keep membership and resume code.
  localSessionController?.leaveRound();
  entryScreen.hidden = false;
  setupScreen.hidden = true;
  onlineScreen.hidden = true;
  gameScreen.hidden = true;
  appShell.classList.remove("is-playing", "is-ports-mode");
  gameBackButton.hidden = true;
  sessionBadge.textContent = "Múltiplos de 5";
  navigation.record({ screen: "entry" });
}

function navigateToScreen(route) {
  clearOnlinePresentationTimer();
  resetPresentationBarrier();
  // Local snapshots are not persisted. Once exit is accepted, discard only the
  // active in-memory round; configuration and completed history are retained.
  if (route.screen !== "local-round") localSessionController?.leaveRound();
  if (route.screen === "local-setup" || route.screen === "local-round") {
    if (route.screen === "local-round" && !localSessionController?.getRoundState()) {
      navigation.record({ screen: "local-setup" }, { replace: true });
    }
    return startLocalMode();
  }
  if (route.screen.startsWith("online-")) {
    return startOnlineMode(route.roomCode ?? "", {
      resumeSaved: false, recordEntry: false, joinOnly: route.screen === "online-join",
    });
  }
  showEntry();
}

gameBackButton.addEventListener("click", () => navigation.back());

revealHandButton.addEventListener("click", () =>
  runIntent(() => sessionController?.revealCurrentHand?.(), ""),
);

passButton.addEventListener("click", () =>
  runIntent(() => sessionController.pass(), "Pase registrado."),
);

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    if (isPresentationBarrierActive({
      feedback: activeFeedbackPresentation,
      presentationQueue: onlineSessionController?.getPresentation()
        .presentationQueue,
      roundResultPending,
    })) return;
    sessionController.setViewMode(button.dataset.viewMode);
    setMessage("");
  });
}

setupRoundMode.addEventListener("change", () => {
  sessionController.setRoundMode(setupRoundMode.value);
});

for (const element of seatConfigElements) {
  const control = element.querySelector("[data-seat-control]");
  const nick = element.querySelector("[data-seat-nick]");
  control.addEventListener("change", () => {
    runIntent(() => sessionController.setSeats(collectSetupSeats()), "");
  });
  nick.addEventListener("change", () => {
    runIntent(() => sessionController.setSeats(collectSetupSeats()), "");
  });
}

for (const input of initialModeInputs) {
  input.addEventListener("change", () => {
    if (input.checked) {
      sessionController.setInitialViewMode(input.value);
    }
  });
}

setupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runIntent(
    () => {
      const seats = collectSetupSeats();
      sessionController.setSeats(seats);
      const firstHuman = seats.find(
        (seat) => seat.controlType === SEAT_CONTROL_TYPES.HUMAN,
      );
      profileStore.save({ nick: firstHuman?.nick ?? "" });
      sessionController.startNewGame();
    },
    "",
  );
});

playAgainButton.addEventListener("click", () =>
  runIntent(
    () => sessionController.playAgain(),
    "",
  ),
);

changeConfigButton.addEventListener("click", () => {
  try {
    sessionController.changeConfiguration();
    setupRoundMode.focus();
  } catch (error) {
    setMessage(error.message);
  }
});

document.querySelector("#round-home-action").addEventListener("click", () => {
  if (sessionController?.getPresentation().round?.isFinished && !roundResultPending &&
      !activeFeedbackPresentation) showEntry();
});

document.querySelector("#choose-local-action").addEventListener(
  "click",
  startLocalMode,
);

document.querySelector("#choose-online-action").addEventListener(
  "click",
  () => void startOnlineMode("", { resumeSaved: false }),
);

document.querySelector("#resume-room-action").addEventListener("click", () =>
  void startOnlineMode(onlineRoomStore.load().roomCode),
);

document.querySelector("#local-back-action").addEventListener(
  "click",
  () => navigation.back(),
);

document.querySelector("#online-back-action").addEventListener(
  "click",
  () => navigation.back(),
);

document.querySelector("#create-room-action").addEventListener("click", () => {
  void withOnlineBusy(async () => {
    const nick = onlineNick.value.trim();
    if (!nick) throw new Error("Escribe tu nombre de jugador.");
    profileStore.save({ nick });
    await onlineSessionController.createRoom(nick);
    onlineRoomStore.save({
      roomCode: onlineSessionController.getPresentation().room.roomCode,
    });
  });
});

onlineJoinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void withOnlineBusy(async () => {
    const nick = onlineNick.value.trim();
    const roomCode = onlineRoomCode.value.trim();
    if (!nick) throw new Error("Escribe tu nombre de jugador.");
    if (!roomCode) throw new Error("Escribe el código de sala.");
    profileStore.save({ nick });
    await onlineSessionController.joinRoom({ roomCode, nick });
    onlineRoomStore.save({
      roomCode: onlineSessionController.getPresentation().room.roomCode,
    });
  });
});

document.querySelector("#copy-room-link-action").addEventListener(
  "click",
  () => void withOnlineBusy(async () => {
    const roomCode = onlineSessionController.getPresentation().room.roomCode;
    const url = new URL(window.location.href);
    url.searchParams.set("room", roomCode);
    await navigator.clipboard.writeText(url.href);
    onlineStatus.textContent = "Enlace copiado.";
  }),
);

document.querySelector("#copy-room-code-action").addEventListener(
  "click",
  () => void withOnlineBusy(async () => {
    const roomCode = onlineSessionController.getPresentation().room.roomCode;
    await navigator.clipboard.writeText(roomCode);
    onlineStatus.textContent = "Código copiado.";
  }),
);

startOnlineButton.addEventListener("click", () => {
  void withOnlineBusy(() =>
    onlineSessionController.startMatch(onlineRoundMode.value)
  );
});

const savedProfile = profileStore.load();
onlineNick.value = savedProfile.nick || "";
const initialRoomCode = initialUrlRoom ??
  (restoredRoute?.screen === "entry" ? "" : onlineRoomStore.load().roomCode);
if (initialRoomCode) {
  void startOnlineMode(initialRoomCode, { recordEntry: !restoredRoute });
} else if (restoredRoute?.screen.startsWith("local-")) {
  navigation.record({ screen: "local-setup" }, { replace: true });
  startLocalMode();
} else {
  showEntry();
}

async function resyncOnlineSession() {
  if (!onlineSessionController) return;
  try {
    await onlineSessionController.resync();
  } catch (error) {
    onlineStatus.textContent = error.message;
  }
}

window.addEventListener("online", () => void resyncOnlineSession());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) void resyncOnlineSession();
});
