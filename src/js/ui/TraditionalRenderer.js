import {
  calculateTraditionalFitScale,
  createTraditionalScene,
  TRADITIONAL_FINAL_MIN_SCALE,
} from "./TraditionalScene.js";
import {
  createTraditionalFitCamera,
  isTraditionalOrientationChange,
  preserveTraditionalCamera,
  revealTraditionalWorldBounds,
} from "./TraditionalCamera.js";
import { traditionalTileBounds } from "./TraditionalSnakeLayout.js";
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

function renderLockedRamifierSocket(socket) {
  return `<span class="traditional-ramifier-socket is-locked points-${socket.side}" style="--target-x:${socket.x}px;--target-y:${socket.y}px" data-locked-port="${escapeAttribute(socket.portId)}" aria-hidden="true"><span></span></span>`;
}

/** Serialización comprobable sin incorporar un DOM a la suite. */
export function renderTraditionalTableMarkup(scene) {
  const startMarkup = scene.canStart
    ? '<div class="traditional-start"><button type="button" class="primary-action" data-start-action>Jugar</button></div>'
    : "";
  return `
    <div class="traditional-table" style="--table-width:${scene.width}px;--table-height:${scene.height}px" role="group" aria-label="Mesa tradicional de dominó">
      <div class="traditional-camera-controls">
        <button type="button" data-fit-table aria-label="Ajustar y centrar la mesa">${scene.isFinished ? "Centrar mesa" : "Ajustar tablero"}</button>
      </div>
      <div class="traditional-table__viewport" data-table-viewport tabindex="0" aria-label="Ventana desplazable sobre la mesa; arrastra para recorrerla">
        <div class="traditional-table__canvas" data-table-canvas>
          <div class="traditional-table__surface">
            ${scene.connections.map(renderConnection).join("")}
            ${scene.tiles.map(renderTile).join("")}
            ${scene.lockedRamifierSockets.map(renderLockedRamifierSocket).join("")}
            ${scene.openTargets.map(renderTarget).join("")}
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
    this.cameraState = null;
    this.layoutState = null;
    this.resizeObserver = null;
    this.viewportSize = null;
    this.autoPanTarget = null;
  }

  render(presentation, { onTarget, onStart } = {}) {
    const previousViewport = this.container.querySelector(
      "[data-table-viewport]",
    );
    if (previousViewport && this.cameraState && this.autoPanTarget === null) {
      this.cameraState = {
        ...this.cameraState,
        left: previousViewport.scrollLeft,
        top: previousViewport.scrollTop,
      };
    }
    const previousPlacementIds = new Set(
      this.layoutState?.tiles?.map((tile) => tile.placementId) ?? [],
    );
    const scene = createTraditionalScene(presentation.traditionalView, {
      selectedDominoId: presentation.selectedDominoId,
      legalTargets: presentation.selectedLegalTargets,
      isFinished: presentation.isFinished,
      scoringResolution: presentation.scoringResolution ?? null,
      previousLayout: this.layoutState,
    });
    const currentPlacementIds = new Set(
      scene.tiles.map((tile) => tile.placementId),
    );
    const continuesWorld =
      (previousPlacementIds.size === 0 && currentPlacementIds.size <= 1) ||
      (
        currentPlacementIds.size >= previousPlacementIds.size &&
        currentPlacementIds.size <= previousPlacementIds.size + 1 &&
        [...previousPlacementIds].every((placementId) =>
          currentPlacementIds.has(placementId)
        )
      );
    if (!continuesWorld) {
      this.cameraState = null;
      this.viewportSize = null;
      this.autoPanTarget = null;
    }
    const addedTiles = scene.tiles.filter(
      (tile) => !previousPlacementIds.has(tile.placementId),
    );
    this.layoutState = scene.layoutState;
    this.container.innerHTML = renderTraditionalTableMarkup(scene);
    const viewport = this.container.querySelector("[data-table-viewport]");
    const canvas = viewport.querySelector("[data-table-canvas]");
    const viewportDimensions = () => ({
      width: Math.max(viewport.clientWidth, 1),
      height: Math.max(viewport.clientHeight, 1),
    });
    const applyCamera = (camera, { smooth = false } = {}) => {
      canvas.style.setProperty("--table-scale", String(camera.scale));
      canvas.style.setProperty("--scaled-table-width", `${scene.width * camera.scale}px`);
      canvas.style.setProperty("--scaled-table-height", `${scene.height * camera.scale}px`);
      if (smooth && typeof viewport.scrollTo === "function") {
        this.autoPanTarget = { left: camera.left, top: camera.top };
        viewport.scrollTo({ left: camera.left, top: camera.top, behavior: "smooth" });
      } else {
        this.autoPanTarget = null;
        viewport.scrollLeft = camera.left;
        viewport.scrollTop = camera.top;
      }
      this.cameraState = { ...camera };
      this.viewportSize = {
        width: camera.viewportWidth,
        height: camera.viewportHeight,
      };
    };
    const fitAndPosition = () => {
      const dimensions = viewportDimensions();
      const scale = calculateTraditionalFitScale({
        contentWidth: scene.contentBounds.width,
        contentHeight: scene.contentBounds.height,
        viewportWidth: dimensions.width,
        viewportHeight: dimensions.height,
        minScale: scene.isFinished
          ? TRADITIONAL_FINAL_MIN_SCALE
          : undefined,
      });
      const camera = createTraditionalFitCamera({
        scale,
        contentBounds: scene.contentBounds,
        tableWidth: scene.width,
        tableHeight: scene.height,
        viewportWidth: dimensions.width,
        viewportHeight: dimensions.height,
      });
      applyCamera(camera);
      return camera;
    };
    if (this.cameraState === null) {
      fitAndPosition();
    } else {
      const dimensions = viewportDimensions();
      let camera = preserveTraditionalCamera(this.cameraState, {
        tableWidth: scene.width,
        tableHeight: scene.height,
        viewportWidth: dimensions.width,
        viewportHeight: dimensions.height,
      });
      if (addedTiles.length === 1) {
        camera = revealTraditionalWorldBounds(
          camera,
          traditionalTileBounds(addedTiles[0]),
          {
            tableWidth: scene.width,
            tableHeight: scene.height,
            viewportWidth: dimensions.width,
            viewportHeight: dimensions.height,
          },
        );
      }
      const moved = camera.left !== this.cameraState.left ||
        camera.top !== this.cameraState.top;
      const reduceMotion = globalThis.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches ?? false;
      applyCamera(camera, { smooth: moved && addedTiles.length === 1 && !reduceMotion });
    }
    this.container.querySelector("[data-fit-table]")?.addEventListener(
      "click",
      fitAndPosition,
    );
    this.resizeObserver?.disconnect();
    if (typeof ResizeObserver === "function") {
      this.resizeObserver = new ResizeObserver(() => {
        const nextSize = viewportDimensions();
        if (
          this.viewportSize?.width === nextSize.width &&
          this.viewportSize?.height === nextSize.height
        ) {
          return;
        }
        if (isTraditionalOrientationChange(this.viewportSize, nextSize)) {
          fitAndPosition();
          return;
        }
        applyCamera(preserveTraditionalCamera(this.cameraState, {
          tableWidth: scene.width,
          tableHeight: scene.height,
          viewportWidth: nextSize.width,
          viewportHeight: nextSize.height,
        }));
      });
      this.resizeObserver.observe(viewport);
    }
    viewport.addEventListener("scrollend", () => {
      if (this.autoPanTarget === null) return;
      this.cameraState = {
        ...this.cameraState,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
      };
      this.autoPanTarget = null;
    });
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
      this.autoPanTarget = null;
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
      this.cameraState = {
        ...this.cameraState,
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
