import { createGraphScene } from "./GraphScene.js";

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderEdge(edge) {
  const label = `Ficha ${edge.a}-${edge.b}, jugada por ${edge.playerId} en la acción ${edge.turnNumber}`;
  return `
    <g class="graph-edge" data-placement-id="${escapeAttribute(edge.placementId)}" role="button" tabindex="0" aria-label="${escapeAttribute(label)}">
      <path class="graph-edge__line" d="${edge.path}"></path>
      <rect class="graph-edge__badge" x="${edge.labelX - 21}" y="${edge.labelY - 12}" width="42" height="24" rx="12"></rect>
      <text class="graph-edge__label" x="${edge.labelX}" y="${edge.labelY}">${edge.a}·${edge.b}</text>
    </g>`;
}

function renderLoop(loop) {
  return `
    <g class="graph-loop" data-placement-id="${escapeAttribute(loop.placementId)}" role="button" tabindex="0" aria-label="${escapeAttribute(`Chancho ${loop.a}-${loop.b}, jugado por ${loop.playerId} en la acción ${loop.turnNumber}`)}">
      <path class="graph-loop__shape" d="${loop.path}"></path>
      <text class="graph-loop__label" x="${loop.labelX}" y="${loop.labelY}">${loop.a}|${loop.b}</text>
    </g>`;
}

function renderOpenTarget(target, hasSelection) {
  const stateClass = target.isLegal
    ? "is-legal"
    : hasSelection
      ? "is-incompatible"
      : "is-neutral";
  return `
    <g class="open-target ${stateClass}" data-target-id="${escapeAttribute(target.id)}" role="button" tabindex="${target.isLegal ? "0" : "-1"}" aria-disabled="${target.isLegal ? "false" : "true"}" aria-label="${target.accessibleLabel}">
      <path class="open-target__hit" d="${target.path}"></path>
      <path class="open-target__curve" d="${target.path}"></path>
      <circle class="open-target__end" cx="${target.endX}" cy="${target.endY}" r="8"></circle>
      <text class="open-target__index" x="${target.endX}" y="${target.endY}">${target.index}</text>
    </g>`;
}

function renderVertex(vertex, hasSelection) {
  const stateClass = vertex.isCompatible
    ? "is-compatible"
    : hasSelection
      ? "is-incompatible"
      : "is-neutral";
  const count = vertex.legalTargetIds.length;
  const actionHint = count === 1
    ? ", un destino compatible"
    : count > 1
      ? `, ${count} destinos compatibles; elija una curva`
      : "";
  return `
    <g class="graph-vertex ${stateClass}" data-vertex-value="${vertex.value}" role="button" tabindex="${count > 0 ? "0" : "-1"}" aria-disabled="${count > 0 ? "false" : "true"}" aria-label="Valor ${vertex.value}${actionHint}">
      <circle class="graph-vertex__touch" cx="${vertex.x}" cy="${vertex.y}" r="43"></circle>
      <circle class="graph-vertex__circle" cx="${vertex.x}" cy="${vertex.y}" r="35"></circle>
      <text class="graph-vertex__value" x="${vertex.x}" y="${vertex.y}">${vertex.value}</text>
    </g>`;
}

/** Serialización SVG comprobable sin instalar un DOM de tests. */
export function renderGraphSvgMarkup(scene) {
  return `
    <svg class="value-graph" viewBox="${scene.viewBox}" role="group" aria-labelledby="graph-title graph-description" preserveAspectRatio="xMidYMid meet">
      <title id="graph-title">Grafo de valores de la ronda</title>
      <desc id="graph-description">Siete valores fijos. Las líneas sólidas son fichas jugadas y las curvas cortas son destinos disponibles.</desc>
      <circle class="graph-orbit" cx="380" cy="300" r="218"></circle>
      <g class="graph-edges">${scene.edges.map(renderEdge).join("")}</g>
      <g class="graph-loops">${scene.loops.map(renderLoop).join("")}</g>
      <g class="graph-open-targets">${scene.openTargets.map((target) => renderOpenTarget(target, scene.hasSelection)).join("")}</g>
      <g class="graph-multiplicities">${scene.multiplicities.map((item) => `<text class="graph-multiplicity" x="${item.x}" y="${item.y}" aria-hidden="true">×${item.count}</text>`).join("")}</g>
      <g class="graph-vertices">${scene.vertices.map((vertex) => renderVertex(vertex, scene.hasSelection)).join("")}</g>
    </svg>`;
}

function activateOnKeyboard(element, callback) {
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback();
    }
  });
}

export class GraphRenderer {
  constructor(container) {
    if (!container) {
      throw new TypeError("GraphRenderer requiere un contenedor.");
    }
    this.container = container;
  }

  render(
    presentation,
    { onTarget, onStart, onInspectEdge, onMessage } = {},
  ) {
    const scene = createGraphScene(presentation.view, {
      selectedDominoId: presentation.selectedDominoId,
      legalTargets: presentation.selectedLegalTargets,
    });
    const startMarkup = scene.canStart
      ? `<div class="start-action"><p>El tablero aún está vacío.</p><button type="button" class="primary-action" data-start-action>Jugar ficha seleccionada</button></div>`
      : "";
    this.container.innerHTML = `${renderGraphSvgMarkup(scene)}${startMarkup}`;

    const targetById = new Map(
      scene.openTargets.map((target) => [target.id, target]),
    );
    const edgeByPlacementId = new Map(
      [...scene.edges, ...scene.loops].map((edge) => [edge.placementId, edge]),
    );
    for (const element of this.container.querySelectorAll(
      ".graph-edge, .graph-loop",
    )) {
      const activate = () =>
        onInspectEdge?.(edgeByPlacementId.get(element.dataset.placementId));
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }
    for (const element of this.container.querySelectorAll(
      ".open-target.is-legal",
    )) {
      const activate = () => onTarget?.(targetById.get(element.dataset.targetId));
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }

    for (const element of this.container.querySelectorAll(
      ".graph-vertex.is-compatible",
    )) {
      const vertex = scene.vertices.find(
        (candidate) => candidate.value === Number(element.dataset.vertexValue),
      );
      const activate = () => {
        if (vertex.legalTargetIds.length === 1) {
          onTarget?.(targetById.get(vertex.legalTargetIds[0]));
          return;
        }
        onMessage?.(
          `Hay ${vertex.legalTargetIds.length} destinos de valor ${vertex.value}; elige una curva numerada.`,
        );
        this.container
          .querySelector(`[data-target-id="${vertex.legalTargetIds[0]}"]`)
          ?.focus();
      };
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }

    this.container
      .querySelector("[data-start-action]")
      ?.addEventListener("click", () => onStart?.({ kind: "START" }));

    return scene;
  }
}
