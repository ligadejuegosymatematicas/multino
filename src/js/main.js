import {
  GraphRenderer,
  TraditionalRenderer,
} from "./ui/BoardRenderer.js";
import { renderHand } from "./ui/HandRenderer.js";
import {
  getGameFeedback,
  renderGameFeedback,
} from "./ui/GameFeedback.js";
import {
  LOCAL_GAME_SCREENS,
  LocalGameSessionController,
} from "./ui/LocalGameSessionController.js";
import {
  renderRoundResult,
  renderScorePanel,
  renderScoringPanel,
} from "./ui/ScorePanel.js";
import {
  renderPlayerCounts,
  renderTurnPanel,
} from "./ui/TurnIndicator.js";
import {
  BOARD_VIEW_MODES,
} from "./ui/ViewModeController.js";

const participantConfig = {
  players: [
    { id: "P1", teamId: "A", displayName: "Ada" },
    { id: "P2", teamId: "B", displayName: "Bruno" },
    { id: "P3", teamId: "A", displayName: "Celia" },
    { id: "P4", teamId: "B", displayName: "Diego" },
  ],
  teams: [
    { id: "A", playerIds: ["P1", "P3"], displayName: "Órbita" },
    { id: "B", playerIds: ["P2", "P4"], displayName: "Vector" },
  ],
  seating: {
    counterclockwisePlayerIds: ["P1", "P2", "P3", "P4"],
  },
};

const boardRoot = document.querySelector("#board-root");
const graphRenderer = new GraphRenderer(boardRoot);
const traditionalRenderer = new TraditionalRenderer(boardRoot);
const passButton = document.querySelector("#pass-action");
const message = document.querySelector("#game-message");
const boardHeading = document.querySelector("#board-heading");
const graphLegend = document.querySelector("#graph-legend");
const modeButtons = [...document.querySelectorAll("[data-view-mode]")];
const setupScreen = document.querySelector("#setup-screen");
const gameScreen = document.querySelector("#game-screen");
const setupForm = document.querySelector("#setup-form");
const setupK = document.querySelector("#setup-k");
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
const handPrivacyInstruction = document.querySelector(
  "#hand-privacy-instruction",
);
const revealHandButton = document.querySelector("#reveal-hand-action");
const scoringCard = document.querySelector("#scoring-card");
let sessionController;
let lastFeedbackSequence = null;
let feedbackHideTimer = null;

function setMessage(text) {
  message.textContent = text;
}

function scheduleFeedbackHide(feedback) {
  if (feedbackHideTimer !== null) {
    window.clearTimeout(feedbackHideTimer);
    feedbackHideTimer = null;
  }
  if (!feedback?.message) {
    return;
  }
  feedbackHideTimer = window.setTimeout(() => {
    renderGameFeedback(playFeedback, null);
    feedbackHideTimer = null;
  }, 2100);
}

function runIntent(intent, successMessage) {
  try {
    intent();
    setMessage(successMessage);
  } catch (error) {
    setMessage(error.message);
  }
}

function describeStructure(presentation, structureId) {
  if (structureId === "main") {
    return "la línea principal";
  }
  return presentation.view.topology.branchFamilies.find(
    (family) => family.id === structureId,
  )?.label ?? "la ramificación";
}

function inspectStructure(structureId) {
  const presentation = sessionController.getPresentation().round;
  const wasInspected = presentation.inspectedStructureId === structureId;
  runIntent(
    () => sessionController.inspectStructure(structureId),
    wasInspected
      ? "Inspección topológica cerrada."
      : `Inspeccionando ${describeStructure(presentation, structureId)}.`,
  );
}

function renderRound(presentation, mode, feedback) {
  const renderer = mode === BOARD_VIEW_MODES.GRAPH
    ? graphRenderer
    : traditionalRenderer;
  boardRoot.dataset.viewMode = mode;
  boardRoot.classList.toggle(
    "is-traditional-view",
    mode === BOARD_VIEW_MODES.TRADITIONAL,
  );
  boardHeading.textContent = mode === BOARD_VIEW_MODES.GRAPH
    ? "Grafo de valores"
    : "Mesa tradicional";
  graphLegend.hidden = mode !== BOARD_VIEW_MODES.GRAPH;
  for (const button of modeButtons) {
    const isActive = button.dataset.viewMode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
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
          ? "Inspección topológica cerrada."
          : `Inspeccionando ${describeStructure(presentation, structureId)}.`,
      );
    },
    onInspectStructure: inspectStructure,
    onClearInspection: () =>
      runIntent(
        () => sessionController.clearInspection(),
        "Inspección topológica cerrada.",
      ),
    onMessage: setMessage,
  });
  const handIsVisible = presentation.handPrivacy.isRevealed &&
    !presentation.isFinished;
  handPanel.hidden = presentation.isFinished;
  handContent.hidden = !handIsVisible;
  handPrivacy.hidden = handIsVisible || presentation.isFinished;
  handPrivacyTitle.textContent =
    `Turno de ${presentation.handPrivacy.displayName}`;
  handPrivacyInstruction.textContent =
    `Entrega el dispositivo a ${presentation.handPrivacy.displayName}.`;
  if (handIsVisible) {
    renderHand(document.querySelector("#hand-root"), presentation, {
      onSelect: (dominoId) =>
        runIntent(
          () => sessionController.selectDomino(dominoId),
          "",
        ),
    });
  } else {
    document.querySelector("#hand-root").replaceChildren();
  }
  renderTurnPanel(
    document.querySelector("#turn-panel"),
    presentation.view,
    { emphasize: feedback !== null && !feedback.endedRound },
  );
  renderPlayerCounts(
    document.querySelector("#player-counts"),
    presentation.view,
  );
  renderScorePanel(
    document.querySelector("#score-panel"),
    presentation.view,
    { feedback },
  );
  renderScoringPanel(
    document.querySelector("#scoring-panel"),
    presentation.view,
  );
  scoringCard.hidden = !presentation.view.scoringPresentation.enabled;
  renderRoundResult(
    document.querySelector("#round-result"),
    presentation.view,
  );
  renderGameFeedback(playFeedback, feedback);

  passButton.disabled = !presentation.canPass || presentation.isFinished;
  roundActions.hidden = !presentation.isFinished;
  const selectedCount = presentation.selectedLegalTargets.length;
  document.querySelector("#selection-hint").textContent = presentation.isFinished
    ? `La ronda terminó. ${mode === BOARD_VIEW_MODES.GRAPH ? "El grafo" : "La mesa"} permanece visible.`
    : !presentation.handPrivacy.isRevealed
      ? `Entrega el dispositivo a ${presentation.handPrivacy.displayName} y muestra su mano.`
    : presentation.selectedDominoId === null
      ? "Selecciona una ficha jugable para destacar sus extremos compatibles."
      : presentation.selectedLegalTargets.some((target) => target.kind === "START")
        ? "La ficha puede iniciar el tablero con la acción inferior."
        : selectedCount === 1
          ? "Un destino compatible; activa su extremo."
          : `${selectedCount} destinos compatibles; elige el extremo lógico concreto.`;
}

function renderSession(session) {
  const isConfiguring = session.screen === LOCAL_GAME_SCREENS.CONFIGURATION;
  setupScreen.hidden = !isConfiguring;
  gameScreen.hidden = isConfiguring;
  appShell.classList.toggle("is-playing", !isConfiguring);
  setupK.value = String(session.config.K);
  for (const input of initialModeInputs) {
    input.checked = input.value === session.config.initialViewMode;
  }
  sessionBadge.textContent = isConfiguring
    ? "Múltiplos de 5"
    : `K=${session.config.K} · ${session.viewMode === BOARD_VIEW_MODES.GRAPH ? "Grafo" : "Tradicional"}`;
  if (!isConfiguring) {
    const nextFeedback = getGameFeedback(session.round.view);
    const feedback = nextFeedback?.sequence !== lastFeedbackSequence
      ? nextFeedback
      : null;
    renderRound(session.round, session.viewMode, feedback);
    scheduleFeedbackHide(feedback);
    lastFeedbackSequence = nextFeedback?.sequence ?? null;
  } else {
    lastFeedbackSequence = null;
    renderGameFeedback(playFeedback, null);
    scheduleFeedbackHide(null);
  }
}

sessionController = new LocalGameSessionController({
  participants: participantConfig,
  onChange: renderSession,
});

revealHandButton.addEventListener("click", () =>
  runIntent(() => sessionController.revealCurrentHand(), ""),
);

passButton.addEventListener("click", () =>
  runIntent(() => sessionController.pass(), "Pase registrado."),
);

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    sessionController.setViewMode(button.dataset.viewMode);
    setMessage("");
  });
}

setupK.addEventListener("change", () => {
  sessionController.setK(Number(setupK.value));
});

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
    () => sessionController.startNewGame(),
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
    setupK.focus();
  } catch (error) {
    setMessage(error.message);
  }
});

sessionController.start();
