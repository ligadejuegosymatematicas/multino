import { createMatch } from "./game/index.js";
import {
  GraphRenderer,
  TraditionalRenderer,
} from "./ui/BoardRenderer.js";
import { renderHand } from "./ui/HandRenderer.js";
import { InteractionController } from "./ui/InteractionController.js";
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
  ViewModeController,
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
let controller;

const viewModeController = new ViewModeController({
  onChange: () => {
    if (controller) {
      render(controller.getPresentation());
    }
  },
});

function setMessage(text) {
  message.textContent = text;
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
  const presentation = controller.getPresentation();
  const wasInspected = presentation.inspectedStructureId === structureId;
  runIntent(
    () => controller.inspectStructure(structureId),
    wasInspected
      ? "Inspección topológica cerrada."
      : `Inspeccionando ${describeStructure(presentation, structureId)}.`,
  );
}

function render(presentation) {
  const mode = viewModeController.getMode();
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

  renderer.render(presentation, {
    onTarget: (target) =>
      runIntent(() => controller.submitTarget(target), "Jugada aplicada."),
    onStart: (target) =>
      runIntent(() => controller.submitTarget(target), "Primera jugada aplicada."),
    onInspectEdge: (edge) => {
      const presentation = controller.getPresentation();
      const structureId = edge.topology.familyId ?? "main";
      const wasInspected = presentation.inspectedStructureId === structureId;
      runIntent(
        () => controller.inspectPlacement(edge.placementId),
        wasInspected
          ? "Inspección topológica cerrada."
          : `Inspeccionando ${describeStructure(presentation, structureId)}.`,
      );
    },
    onInspectStructure: inspectStructure,
    onClearInspection: () =>
      runIntent(
        () => controller.clearInspection(),
        "Inspección topológica cerrada.",
      ),
    onMessage: setMessage,
  });
  renderHand(document.querySelector("#hand-root"), presentation, {
    onSelect: (dominoId) =>
      runIntent(
        () => controller.selectDomino(dominoId),
        `Ficha ${dominoId} seleccionada.`,
      ),
  });
  renderTurnPanel(document.querySelector("#turn-panel"), presentation.view);
  renderPlayerCounts(
    document.querySelector("#player-counts"),
    presentation.view,
  );
  renderScorePanel(document.querySelector("#score-panel"), presentation.view);
  renderScoringPanel(
    document.querySelector("#scoring-panel"),
    presentation.view,
  );
  renderRoundResult(
    document.querySelector("#round-result"),
    presentation.view,
  );

  passButton.disabled = !presentation.canPass || presentation.isFinished;
  const selectedCount = presentation.selectedLegalTargets.length;
  document.querySelector("#selection-hint").textContent = presentation.isFinished
    ? `La ronda terminó. ${mode === BOARD_VIEW_MODES.GRAPH ? "El grafo" : "La mesa"} permanece visible.`
    : presentation.selectedDominoId === null
      ? "Selecciona una ficha jugable para destacar sus extremos compatibles."
      : presentation.selectedLegalTargets.some((target) => target.kind === "START")
        ? "La ficha puede iniciar el tablero con la acción inferior."
        : selectedCount === 1
          ? "Un destino compatible; activa su extremo."
          : `${selectedCount} destinos compatibles; elige el extremo lógico concreto.`;
}

controller = new InteractionController({
  initialState: createMatch({
    ...participantConfig,
    matchId: "graph-prototype-local",
    K: 7,
  }),
  onChange: render,
});

passButton.addEventListener("click", () =>
  runIntent(() => controller.pass(), "Pase registrado."),
);

for (const button of modeButtons) {
  button.addEventListener("click", () => {
    viewModeController.setMode(button.dataset.viewMode);
    setMessage(
      button.dataset.viewMode === BOARD_VIEW_MODES.GRAPH
        ? "Vista de grafo activa."
        : "Vista tradicional activa.",
    );
  });
}

controller.start();
setMessage("Ronda local preparada.");
