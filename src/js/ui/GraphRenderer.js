import { createGraphScene } from "./GraphScene.js";

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getTopologyClasses(edge) {
  return [
    edge.topology.region === "main" ? "is-main" : "is-branch",
    edge.topology.isSpecialDouble ? "is-special-double" : "",
    edge.isInspected ? "is-inspected" : "",
    edge.isTopologyHighlighted ? "is-topology-highlighted" : "",
    edge.isTopologyRoot ? "is-topology-root" : "",
    edge.isTopologyDimmed ? "is-topology-dimmed" : "",
  ].filter(Boolean).join(" ");
}

function describeTopology(topology) {
  return topology.region === "main"
    ? `línea principal, posición ${topology.order}`
    : `rama, posición ${topology.depth}`;
}

function renderSpecialMarker(edge) {
  if (!edge.topology.isSpecialDouble) {
    return "";
  }
  const markerX = edge.labelX + 31;
  const markerY = edge.labelY;
  return `
      <g class="graph-special-marker" transform="translate(${markerX} ${markerY})" aria-hidden="true">
        <circle class="graph-special-marker__outer" r="11"></circle>
        <circle class="graph-special-marker__inner" r="7"></circle>
        <path class="graph-special-marker__arms" d="M 0 -7 V 7 M -7 0 H 7"></path>
        <circle class="graph-special-marker__hub" r="2.2"></circle>
      </g>`;
}

function renderEdge(edge) {
  const label = `Ficha ${edge.a}-${edge.b}, ${describeTopology(edge.topology)}, jugada por ${edge.playerId} en la acción ${edge.turnNumber}`;
  return `
    <g class="graph-edge ${getTopologyClasses(edge)}" data-placement-id="${escapeAttribute(edge.placementId)}" data-region="${edge.topology.region}" data-special-double="${edge.topology.isSpecialDouble}" role="button" tabindex="0" aria-pressed="${edge.isInspected}" aria-label="${escapeAttribute(label)}">
      <path class="graph-edge__line" d="${edge.path}"></path>
      <rect class="graph-edge__badge" x="${edge.labelX - 21}" y="${edge.labelY - 12}" width="42" height="24" rx="12"></rect>
      <text class="graph-edge__label" x="${edge.labelX}" y="${edge.labelY}">${edge.a}·${edge.b}</text>
      ${renderSpecialMarker(edge)}
    </g>`;
}

function renderLoop(loop) {
  const label = `Chancho ${loop.a}-${loop.b}, ${describeTopology(loop.topology)}, ${loop.topology.isSpecialDouble ? "especial" : "ordinario"}, jugado por ${loop.playerId} en la acción ${loop.turnNumber}`;
  return `
    <g class="graph-loop ${getTopologyClasses(loop)}" data-placement-id="${escapeAttribute(loop.placementId)}" data-region="${loop.topology.region}" data-special-double="${loop.topology.isSpecialDouble}" role="button" tabindex="0" aria-pressed="${loop.isInspected}" aria-label="${escapeAttribute(label)}">
      <path class="graph-loop__shape" d="${loop.path}"></path>
      <text class="graph-loop__label" x="${loop.labelX}" y="${loop.labelY}">${loop.a}|${loop.b}</text>
      ${renderSpecialMarker(loop)}
    </g>`;
}

function renderOpenTarget(target, hasSelection) {
  const stateClass = target.isLegal
    ? "is-legal"
    : hasSelection
      ? "is-incompatible"
      : "is-neutral";
  const classes = [
    stateClass,
    target.topology.region === "main"
      ? "is-main-target"
      : "is-branch-target",
    target.isTopologyHighlighted ? "is-topology-highlighted" : "",
    target.isTopologyDimmed ? "is-topology-dimmed" : "",
  ].filter(Boolean).join(" ");
  return `
    <g class="open-target ${classes}" data-target-id="${escapeAttribute(target.id)}" data-region="${target.topology.region}" role="button" tabindex="${target.isLegal ? "0" : "-1"}" aria-disabled="${target.isLegal ? "false" : "true"}" aria-label="${escapeAttribute(target.accessibleLabel)}">
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
  const specialSummary = `Especiales: ${scene.topologySummary.enabledCount}/${scene.topologySummary.effectiveK}`;
  return `
    <svg class="value-graph" viewBox="${scene.viewBox}" role="group" aria-labelledby="graph-title graph-description" preserveAspectRatio="xMidYMid meet">
      <title id="graph-title">Grafo de valores de la ronda</title>
      <desc id="graph-description">Siete valores fijos. El trazo continuo identifica la línea principal y sus destinos; el trazo segmentado identifica ramas y sus destinos. El símbolo de cuatro brazos identifica un chancho especial.</desc>
      <circle class="graph-orbit" cx="380" cy="300" r="218"></circle>
      <g class="graph-edges">${scene.edges.map(renderEdge).join("")}</g>
      <g class="graph-loops">${scene.loops.map(renderLoop).join("")}</g>
      <g class="graph-open-targets">${scene.openTargets.map((target) => renderOpenTarget(target, scene.hasSelection)).join("")}</g>
      <g class="graph-multiplicities">${scene.multiplicities.map((item) => `<text class="graph-multiplicity" x="${item.x}" y="${item.y}" aria-hidden="true">×${item.count}</text>`).join("")}</g>
      <g class="graph-vertices">${scene.vertices.map((vertex) => renderVertex(vertex, scene.hasSelection)).join("")}</g>
      <g class="graph-special-summary" role="note" aria-label="${escapeAttribute(specialSummary)}">
        <rect x="16" y="16" width="142" height="34" rx="17"></rect>
        <text x="87" y="33">${specialSummary}</text>
      </g>
    </svg>`;
}

function describeDoubleRole(doubleRole) {
  switch (doubleRole) {
    case "SPECIAL_MAIN":
      return "Chancho especial en la línea principal";
    case "ORDINARY_MAIN_K_EXHAUSTED":
      return "Chancho ordinario en la línea principal";
    case "ORDINARY_BRANCH":
      return "Chancho ordinario en una rama";
    default:
      return null;
  }
}

export function renderTopologyInspectionMarkup(inspection) {
  if (!inspection) {
    return "";
  }
  const topology = inspection.topology;
  const region = topology.region === "main"
    ? `Esta ficha está en la línea principal · posición ${topology.order}.`
    : `Esta rama nace del chancho ${inspection.rootDominoId?.replace("-", "|") ?? "indicado"}. Esta ficha ocupa la posición ${topology.depth} de la rama.`;
  const doubleRole = describeDoubleRole(topology.doubleRole);
  const doubleDetails = doubleRole
    ? `<p class="topology-inspector__double"><strong>${doubleRole}</strong><span>Conexiones: ${topology.connectionCount}/${topology.connectionCapacity}</span>${topology.isSpecialDouble ? `<span>Ramas iniciadas: ${topology.startedBranchCount}/2</span>` : ""}</p>`
    : "";

  return `
    <aside class="topology-inspector" data-topology-inspection aria-label="Inspección topológica de ${escapeAttribute(inspection.dominoId)}">
      <div>
        <p class="topology-inspector__kicker">Lectura de la partida</p>
        <h3>Ficha ${escapeAttribute(inspection.dominoId.replace("-", "|"))}</h3>
        <p class="topology-inspector__region">${escapeAttribute(region)}</p>
        ${doubleDetails}
      </div>
      <button type="button" class="topology-inspector__close" data-clear-topology-inspection aria-label="Cerrar inspección topológica">Cerrar</button>
    </aside>`;
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
    {
      onTarget,
      onStart,
      onInspectEdge,
      onClearInspection,
      onMessage,
    } = {},
  ) {
    const scene = createGraphScene(presentation.view, {
      selectedDominoId: presentation.selectedDominoId,
      legalTargets: presentation.selectedLegalTargets,
      inspectedPlacementId: presentation.inspectedPlacementId,
    });
    const startMarkup = scene.canStart
      ? `<div class="start-action"><p>El tablero aún está vacío.</p><button type="button" class="primary-action" data-start-action>Jugar ficha seleccionada</button></div>`
      : "";
    this.container.innerHTML = `${renderGraphSvgMarkup(scene)}${startMarkup}${renderTopologyInspectionMarkup(scene.inspection)}`;

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

    const clearInspection = () => onClearInspection?.();
    this.container
      .querySelector("[data-clear-topology-inspection]")
      ?.addEventListener("click", clearInspection);
    for (const element of this.container.querySelectorAll(
      ".value-graph, [data-topology-inspection]",
    )) {
      element.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && scene.inspection) {
          event.preventDefault();
          clearInspection();
        }
      });
    }

    return scene;
  }
}
