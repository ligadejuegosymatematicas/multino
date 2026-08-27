import { createEmptyGameState, getEngineStatus } from "./game/index.js";
import { renderBoardPlaceholder } from "./ui/BoardRenderer.js";
import { renderScoreStatus } from "./ui/ScorePanel.js";

const engineStatus = getEngineStatus();
const emptyState = createEmptyGameState();

renderScoreStatus(
  document.querySelector("#engine-status"),
  engineStatus.loaded
    ? `Cargado · versión ${engineStatus.version}`
    : "No disponible",
);

renderScoreStatus(
  document.querySelector("#state-status"),
  `Esquema JSON v${emptyState.schemaVersion} · sin partida iniciada`,
);

renderScoreStatus(
  document.querySelector("#rules-status"),
  engineStatus.gameplayReady
    ? "Disponibles"
    : engineStatus.boardPlayReady
      ? "Tablero lógico disponible · flujo de turnos y puntuación pendientes"
      : engineStatus.matchSetupReady
        ? "Inicialización disponible · jugadas no implementadas"
      : "Inicialización no disponible",
);

renderBoardPlaceholder(document.querySelector("#board-root"));
