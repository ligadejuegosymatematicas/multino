import {
  calculateTraditionalFitScale,
  createTraditionalScene,
  TRADITIONAL_FINAL_MIN_SCALE,
} from "./TraditionalScene.js";
import { renderPipsMarkup } from "./DominoPips.js";

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderPips(value) {
  return renderPipsMarkup(value, {
    gridClass: "traditional-domino__pips",
    pipClass: "traditional-domino__pip",
  });
}

function tileClasses(tile) {
  return [
    "traditional-domino",
    `is-${tile.orientation}`,
    tile.region === "main" ? "is-main" : "is-branch",
    tile.isDouble ? "is-double" : "",
    tile.isSpecialDouble ? "is-special-double" : "",
    tile.isScoringTerm ? "is-scoring-term" : "",
  ].filter(Boolean).join(" ");
}

function renderTile(tile) {
  const role = tile.isSpecialDouble
    ? "; chancho ramificador"
    : tile.doubleRole === "ORDINARY_DOUBLE"
      ? "; chancho ordinario"
      : "";
  return `
    <div class="${tileClasses(tile)}" style="--tile-x:${tile.x}px;--tile-y:${tile.y}px;--tile-width:${tile.width}px;--tile-height:${tile.height}px" data-placement-id="${escapeAttribute(tile.placementId)}" data-region="${tile.region}" data-special-double="${tile.isSpecialDouble}" role="img" aria-label="Ficha ${tile.firstValue}-${tile.secondValue}${role}">
      <span class="traditional-domino__half">${renderPips(tile.firstValue)}</span>
      <span class="traditional-domino__divider" aria-hidden="true"></span>
      <span class="traditional-domino__half">${renderPips(tile.secondValue)}</span>
      ${tile.isSpecialDouble ? '<span class="traditional-domino__special" aria-hidden="true"></span>' : ""}
    </div>`;
}

function renderConnectionSegment(connection, segment) {
  const thickness = 4;
  const isHorizontal = segment.orientation === "horizontal";
  const left = isHorizontal
    ? Math.min(segment.x, segment.x2)
    : segment.x - thickness / 2;
  const top = isHorizontal
    ? segment.y - thickness / 2
    : Math.min(segment.y, segment.y2);
  const width = isHorizontal
    ? Math.abs(segment.x2 - segment.x)
    : thickness;
  const height = isHorizontal
    ? thickness
    : Math.abs(segment.y2 - segment.y);
  return `<span class="traditional-connection is-${segment.orientation} is-${connection.region}" style="--connection-left:${left}px;--connection-top:${top}px;--connection-width:${width}px;--connection-height:${height}px" data-connection-id="${escapeAttribute(connection.id)}" data-connection-segment="${escapeAttribute(segment.id)}" data-connection-value="${connection.value}" aria-hidden="true"></span>`;
}

function renderConnection(connection) {
  return connection.segments
    .map((segment) => renderConnectionSegment(connection, segment))
    .join("");
}

function renderTarget(target) {
  const classes = [
    "traditional-target",
    `is-${target.state}`,
    `points-${target.direction}`,
    target.topology.region === "main" ? "is-main" : "is-branch",
    target.topology.branchState === "POTENTIAL" ? "is-potential" : "",
    target.topology.branchState === "STARTED" ? "is-started" : "",
    target.isScoringTerm ? "is-scoring-term" : "",
  ].filter(Boolean).join(" ");
  const option = target.optionIndex === null
    ? ""
    : `<span class="traditional-target__option" aria-hidden="true">${target.optionIndex}</span>`;
  return `<button type="button" class="${classes}" style="--target-x:${target.x}px;--target-y:${target.y}px" data-target-id="${escapeAttribute(target.id)}" data-placement-id="${escapeAttribute(target.placementId)}" data-port-id="${escapeAttribute(target.portId)}" data-target-value="${target.value}" aria-label="${escapeAttribute(target.accessibleLabel)}"${target.isDisabled ? " disabled" : ""}><span class="traditional-target__socket" aria-hidden="true"></span>${option}</button>`;
}

/** Serialización comprobable sin incorporar un DOM a la suite. */
export function renderTraditionalTableMarkup(scene) {
  const emptyMessage = scene.tiles.length === 0
    ? '<p class="traditional-table__empty">La mesa está vacía. Selecciona una ficha para comenzar.</p>'
    : "";
  const startMarkup = scene.canStart
    ? '<div class="traditional-start"><button type="button" class="primary-action" data-start-action>Jugar ficha seleccionada</button></div>'
    : "";
  return `
    <div class="traditional-table" style="--table-width:${scene.width}px;--table-height:${scene.height}px" role="group" aria-label="Mesa tradicional de dominó">
      <div class="traditional-camera-controls">
        <button type="button" data-fit-table aria-label="Ajustar y centrar la mesa">${scene.isFinished ? "Ver mesa completa" : "Ajustar tablero"}</button>
      </div>
      <div class="traditional-table__viewport" data-table-viewport tabindex="0" aria-label="Ventana desplazable sobre la mesa; arrastra para recorrerla">
        <div class="traditional-table__canvas" data-table-canvas>
          <div class="traditional-table__surface">
            ${scene.connections.map(renderConnection).join("")}
            ${scene.tiles.map(renderTile).join("")}
            ${scene.openTargets.map(renderTarget).join("")}
            ${emptyMessage}
            ${startMarkup}
          </div>
        </div>
      </div>
    </div>`;
}

export class TraditionalRenderer {
  constructor(container) {
    if (!container) {
      throw new TypeError("TraditionalRenderer requiere un contenedor.");
    }
    this.container = container;
    this.scrollPosition = null;
    this.sceneSignature = null;
    this.resizeObserver = null;
  }

  render(presentation, { onTarget, onStart } = {}) {
    const previousViewport = this.container.querySelector(
      "[data-table-viewport]",
    );
    if (previousViewport) {
      this.scrollPosition = {
        left: previousViewport.scrollLeft,
        top: previousViewport.scrollTop,
      };
    }
    const scene = createTraditionalScene(presentation.traditionalView, {
      selectedDominoId: presentation.selectedDominoId,
      legalTargets: presentation.selectedLegalTargets,
      isFinished: presentation.isFinished,
      scoringResolution: presentation.scoringResolution ?? null,
    });
    this.container.innerHTML = renderTraditionalTableMarkup(scene);
    const viewport = this.container.querySelector("[data-table-viewport]");
    const nextSignature = `${scene.width}:${scene.height}`;
    const shouldRecenter = scene.isFinished ||
      this.sceneSignature === null;
    this.sceneSignature = nextSignature;
    const fitAndPosition = ({ recenter = false } = {}) => {
      const scale = calculateTraditionalFitScale({
        contentWidth: scene.width,
        contentHeight: scene.height,
        viewportWidth: viewport.clientWidth,
        viewportHeight: viewport.clientHeight,
        minScale: scene.isFinished
          ? TRADITIONAL_FINAL_MIN_SCALE
          : undefined,
      });
      const canvas = viewport.querySelector("[data-table-canvas]");
      canvas.style.setProperty("--table-scale", String(scale));
      canvas.style.setProperty("--scaled-table-width", `${scene.width * scale}px`);
      canvas.style.setProperty("--scaled-table-height", `${scene.height * scale}px`);
      if (recenter || this.scrollPosition === null) {
        viewport.scrollLeft = Math.max(
          0,
          (scene.width * scale - viewport.clientWidth) / 2,
        );
        viewport.scrollTop = Math.max(
          0,
          (scene.height * scale - viewport.clientHeight) / 2,
        );
      } else {
        viewport.scrollLeft = this.scrollPosition.left;
        viewport.scrollTop = this.scrollPosition.top;
      }
      this.scrollPosition = {
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
      return scale;
    };
    fitAndPosition({ recenter: shouldRecenter });
    this.container.querySelector("[data-fit-table]")?.addEventListener(
      "click",
      () => fitAndPosition({ recenter: true }),
    );
    this.resizeObserver?.disconnect();
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => {
        fitAndPosition({ recenter: true });
      });
      this.resizeObserver.observe(viewport);
    }
    this.#enableMousePan(viewport);
    const targetById = new Map(
      scene.openTargets.map((target) => [target.id, target]),
    );
    for (const element of this.container.querySelectorAll(
      ".traditional-target:not(:disabled)",
    )) {
      element.addEventListener("click", () =>
        onTarget?.(targetById.get(element.dataset.targetId))
      );
    }
    this.container
      .querySelector("[data-start-action]")
      ?.addEventListener("click", () => onStart?.({ kind: "START" }));
    return scene;
  }

  #enableMousePan(viewport) {
    let drag = null;
    viewport.addEventListener("pointerdown", (event) => {
      if (
        event.pointerType !== "mouse" ||
        event.button !== 0 ||
        event.target.closest("button")
      ) {
        return;
      }
      drag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-panning");
    });
    viewport.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
    });
    const stopPan = (event) => {
      if (!drag || event.pointerId !== drag.pointerId) {
        return;
      }
      this.scrollPosition = {
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
      viewport.classList.remove("is-panning");
      drag = null;
    };
    viewport.addEventListener("pointerup", stopPan);
    viewport.addEventListener("pointercancel", stopPan);
  }
}
