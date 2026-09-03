import {
  createPortScene,
  PORT_SCENE_LAYOUTS,
} from "./PortScene.js";

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function topologyClasses(item) {
  return [
    item.region === "branch" || item.topology?.region === "branch"
      ? "is-branch"
      : "is-main",
    item.familyTone === null || item.familyTone === undefined
      ? ""
      : `family-tone-${item.familyTone}`,
    item.isLive ? "is-live" : "",
    item.isDecisionOwner || item.isDecisionTarget ? "is-decision-owner" : "",
    item.isTopologyHighlighted ? "is-topology-highlighted" : "",
    item.isTopologyRoot ? "is-topology-root" : "",
    item.isTopologyDimmed ? "is-topology-dimmed" : "",
    item.isScoringTerm ? "is-scoring-term" : "",
  ].filter(Boolean).join(" ");
}

function routeLabel(topology) {
  if (!topology || topology.region === "main") {
    return "línea principal";
  }
  return `${topology.structureLabel}, brazo ${topology.armIndex}`;
}

function renderThread(thread) {
  const label = `Ficha ${thread.dominoId.replace("-", "|")}, ${routeLabel(thread.topology)}; inspeccionar recorrido`;
  return `
    <g class="port-thread ${topologyClasses(thread)}" data-placement-id="${escapeAttribute(thread.placementId)}" data-route-id="${escapeAttribute(thread.topology.structureId)}" role="button" tabindex="0" aria-label="${escapeAttribute(label)}">
      <path class="port-thread__hit" d="${thread.path}"></path>
      <path class="port-thread__shadow" d="${thread.path}"></path>
      <path class="port-thread__cord" d="${thread.path}"></path>
    </g>`;
}

function renderBridge(bridge, { focus = false } = {}) {
  const label = `Continuidad por el valor ${bridge.value}, ${bridge.region === "main" ? "principal" : `ramificación, brazo ${bridge.armIndex}`}; inspeccionar recorrido`;
  return `
    <g class="port-bridge${focus ? " is-focus-bridge" : ""} ${topologyClasses(bridge)}" data-connection-id="${escapeAttribute(bridge.connectionId)}" data-route-id="${escapeAttribute(bridge.structureId)}" role="button" tabindex="0" aria-label="${escapeAttribute(label)}">
      <path class="port-bridge__hit" d="${bridge.path}"></path>
      <path class="port-bridge__stitch" d="${bridge.path}"></path>
    </g>`;
}

function renderHubMechanism(hub) {
  return hub.sockets.map((socket) => {
    const lateral = socket.boardPortId.startsWith("branch:")
      ? " is-lateral"
      : "";
    return `<path class="port-double-hub__mechanism${lateral}" d="M ${hub.x} ${hub.y} L ${socket.x} ${socket.y}"></path>`;
  }).join("");
}

function renderHub(hub, { focus = false } = {}) {
  const classes = [
    hub.isSpecial ? "is-special" : "is-ordinary",
    focus ? "is-focus-hub" : "",
    topologyClasses(hub),
  ].filter(Boolean).join(" ");
  const socketMarkup = hub.sockets.map((socket) => `
    <circle class="port-double-hub__socket${socket.connectionId ? " is-used" : ""}${socket.isOpenEnd ? " is-open" : ""}${socket.isDecisionTarget ? " is-decision-target" : ""}" cx="${socket.x}" cy="${socket.y}" r="${focus ? 8 : 6}" data-board-port-id="${escapeAttribute(socket.boardPortId)}"></circle>`).join("");
  return `
    <g class="port-double-hub ${classes}" data-placement-id="${escapeAttribute(hub.placementId)}" data-node-value="${hub.value}" role="button" tabindex="0" aria-label="Chancho ${hub.value}|${hub.value}, ${hub.isSpecial ? "especial con cuatro conexiones" : "ordinario con dos conexiones"}; abrir detalle del valor ${hub.value}">
      <circle class="port-double-hub__rim" cx="${hub.x}" cy="${hub.y}" r="${hub.isSpecial ? (focus ? 31 : 26) : (focus ? 26 : 21)}"></circle>
      <circle class="port-double-hub__body" cx="${hub.x}" cy="${hub.y}" r="${hub.isSpecial ? (focus ? 26 : 21) : (focus ? 21 : 16)}"></circle>
      ${renderHubMechanism(hub)}
      ${socketMarkup}
    </g>`;
}

function renderIncidence(port, { focus = false } = {}) {
  const played = port.state === "PLAYED";
  const interactive = played && port.topology;
  const classes = [
    "port-incidence",
    played ? "is-played" : "is-potential",
    port.isOpenEnd ? "is-open" : "",
    focus ? "is-focus-incidence" : "",
    topologyClasses(port),
  ].filter(Boolean).join(" ");
  const interaction = interactive
    ? ` data-route-id="${escapeAttribute(port.topology.structureId)}" role="button" tabindex="0" aria-label="Incidencia ${port.value} hacia ${port.otherValue}; ${escapeAttribute(routeLabel(port.topology))}; inspeccionar recorrido"`
    : ` aria-hidden="true"`;
  const label = focus
    ? `<text class="port-focus__port-label" x="${port.label.x}" y="${port.label.y}">${port.otherValue}</text>`
    : "";
  return `
    <g class="port-incidence-wrap"${interaction}>
      <circle class="${classes}" cx="${port.x}" cy="${port.y}" r="${focus ? (played ? 10 : 7) : (played ? 6 : 3.2)}"></circle>
      ${label}
    </g>`;
}

function renderNodeShell(node) {
  return `
    <g class="port-macro-node-shell" aria-hidden="true">
      <circle class="port-macro-node__shadow" cx="${node.x}" cy="${node.y + 4}" r="64"></circle>
      <circle class="port-macro-node__rim" cx="${node.x}" cy="${node.y}" r="63"></circle>
      <circle class="port-macro-node__body" cx="${node.x}" cy="${node.y}" r="57"></circle>
      <circle class="port-macro-node__inner" cx="${node.x}" cy="${node.y}" r="48"></circle>
    </g>`;
}

function renderNode(node, isExpanded, hasDoubleHub, { showIncidences = false } = {}) {
  const playedCount = node.ordinaryPorts.filter((port) => port.state === "PLAYED").length;
  const incidences = showIncidences
    ? node.ordinaryPorts.map((port) => renderIncidence(port)).join("")
    : "";
  return `
    <g class="port-macro-node${isExpanded ? " is-expanded" : ""}${hasDoubleHub ? " has-double-hub" : ""}" data-node-value="${node.value}" role="button" tabindex="0" aria-pressed="${isExpanded}" aria-label="Valor ${node.value}; ${playedCount} incidencias utilizadas; abrir el saco">
      <circle class="port-macro-node__hit" cx="${node.x}" cy="${node.y}" r="70"></circle>
      <text class="port-macro-node__value" x="${node.x}" y="${node.y - (hasDoubleHub ? 32 : 0)}">${node.value}</text>
      <g class="port-incidences">${incidences}</g>
    </g>`;
}

function renderOpenTarget(target, hasSelection, { focus = false } = {}) {
  const stateClass = target.isLegal
    ? "is-legal"
    : target.isIncompatible
      ? "is-incompatible"
      : "is-neutral";
  const option = target.optionIndex === null
    ? ""
    : `<text class="port-open-target__option" x="${target.x + (focus ? 18 : 14)}" y="${target.y - (focus ? 17 : 13)}">${target.optionIndex}</text>`;
  const structure = routeLabel(target.topology);
  const tail = focus
    ? ""
    : `<path class="port-open-target__tail" d="${target.tailPath}"></path>`;
  return `
    <g class="port-open-target ${stateClass}${focus ? " is-focus-target" : ""} ${topologyClasses(target)}" data-target-id="${escapeAttribute(target.id)}" data-route-id="${escapeAttribute(target.topology.structureId)}" role="button" tabindex="0" aria-label="Extremo abierto de valor ${target.value}, ${escapeAttribute(structure)}${hasSelection ? target.isLegal ? "; compatible" : "; no compatible" : ""}">
      ${tail}
      <circle class="port-open-target__hit" cx="${target.x}" cy="${target.y}" r="4"></circle>
      <circle class="port-open-target__halo" cx="${target.x}" cy="${target.y}" r="${focus ? 16 : 13}"></circle>
      <circle class="port-open-target__eyelet" cx="${target.x}" cy="${target.y}" r="${focus ? 9 : 7}"></circle>
      <circle class="port-open-target__core" cx="${target.x}" cy="${target.y}" r="${focus ? 4 : 3}"></circle>
      ${option}
    </g>`;
}

function renderFocusPort(port) {
  return renderIncidence(port, { focus: true });
}

function renderNodeFocus(focus, hasSelection) {
  if (!focus) {
    return "";
  }
  return `
    <g class="port-node-focus" data-port-node-focus data-node-value="${focus.value}" role="dialog" aria-label="Detalle ampliado del valor ${focus.value}">
      <circle class="port-node-focus__backdrop" cx="${focus.center.x}" cy="${focus.center.y}" r="${focus.radius + 42}"></circle>
      <circle class="port-node-focus__rim" cx="${focus.center.x}" cy="${focus.center.y}" r="${focus.radius}"></circle>
      <circle class="port-node-focus__body" cx="${focus.center.x}" cy="${focus.center.y}" r="${focus.radius - 8}"></circle>
      <text class="port-node-focus__title" x="${focus.center.x}" y="${focus.center.y - focus.radius - 18}">Conexiones de ${focus.value}</text>
      <g class="port-node-focus__bridges">${focus.bridges.map((bridge) => renderBridge(bridge, { focus: true })).join("")}</g>
      <g class="port-node-focus__ports">${focus.ports.map(renderFocusPort).join("")}</g>
      <g class="port-node-focus__hubs">${focus.hubs.map((hub) => renderHub(hub, { focus: true })).join("")}</g>
      <g class="port-node-focus__targets">${focus.targets.map((target) => renderOpenTarget(target, hasSelection, { focus: true })).join("")}</g>
      <g class="port-node-focus__close" data-close-port-node role="button" tabindex="0" aria-label="Cerrar detalle del valor ${focus.value}">
        <circle cx="${focus.center.x + focus.radius - 5}" cy="${focus.center.y - focus.radius + 5}" r="19"></circle>
        <path d="M ${focus.center.x + focus.radius - 12} ${focus.center.y - focus.radius - 2} L ${focus.center.x + focus.radius + 2} ${focus.center.y - focus.radius + 12} M ${focus.center.x + focus.radius + 2} ${focus.center.y - focus.radius - 2} L ${focus.center.x + focus.radius - 12} ${focus.center.y - focus.radius + 12}"></path>
      </g>
    </g>`;
}

export function renderPortNodeInspectorMarkup(inspector) {
  if (!inspector) {
    return "";
  }
  const bridges = inspector.bridges.length === 0
    ? "<li>Sin continuidades internas todavía.</li>"
    : inspector.bridges.map((bridge) =>
        `<li><strong>${escapeAttribute(bridge.firstLabel)}</strong> ↔ <strong>${escapeAttribute(bridge.secondLabel)}</strong> · ${bridge.region === "main" ? "principal" : "rama"}</li>`
      ).join("");
  const hubs = inspector.hubs.map((hub) =>
    `<p class="port-node-inspector__hub">Chancho ${escapeAttribute(hub.dominoId.replace("-", "|"))}: ${hub.isSpecial ? "especial" : "ordinario"} · ${hub.usedSockets}/${hub.capacity} conexiones</p>`
  ).join("");
  return `
    <aside class="port-node-inspector" data-port-node-inspector aria-label="Resumen del valor ${inspector.value}">
      <div>
        <p class="port-node-inspector__kicker">Valor ${inspector.value}</p>
        <h3>${inspector.playedPortCount} de 6 ojales utilizados</h3>
        ${hubs}
        <details>
          <summary>Ver ${inspector.bridges.length} continuidades</summary>
          <ul>${bridges}</ul>
        </details>
      </div>
    </aside>`;
}

function renderCoverScoring(scoring, cover) {
  if (!scoring) {
    return "";
  }
  return `
    <g class="port-cover__scoring" role="status" aria-label="${escapeAttribute(scoring.expression)} da S igual a ${scoring.sum}; ${scoring.scoreAwarded > 0 ? `${scoring.scoreAwarded} puntos` : "sin puntos"}">
      <text class="port-cover__expression" x="${cover.cx}" y="${cover.cy - 30}">${escapeAttribute(scoring.expression)}</text>
      <text class="port-cover__sum" x="${cover.cx}" y="${cover.cy + 4}">S = ${scoring.sum}</text>
      <text class="port-cover__division" x="${cover.cx}" y="${cover.cy + 32}">${scoring.isDivisible ? `${scoring.sum} = ${scoring.divisor} × ${scoring.quotient}` : `${scoring.sum} no es múltiplo de ${scoring.divisor}`}</text>
      <text class="port-cover__outcome${scoring.scoreAwarded > 0 ? " is-award" : ""}" x="${cover.cx}" y="${cover.cy + 62}">${scoring.scoreAwarded > 0 ? `+${scoring.scoreAwarded} puntos` : "Sin puntos"}</text>
    </g>`;
}

function renderCover(scene) {
  if (scene.nodeFocus) {
    return "";
  }
  const isStructure = scene.showStructure;
  const isRoute = scene.visualState === "route";
  const source = isRoute
    ? scene.threads.find((thread) => thread.isTopologyHighlighted) ??
      scene.openTargets.find((target) => target.isTopologyHighlighted)
    : null;
  const title = isRoute
    ? routeLabel(source?.topology)
    : isStructure
      ? "Estructura visible"
      : "Puertos";
  const action = isRoute || isStructure ? "Volver a jugar" : "Ver estructura";
  const radius = isStructure ? 80 : scene.cover.radius;
  return `
    <g class="port-cover${isStructure ? " is-structure-control" : ""}${isRoute ? " is-route-cover" : ""}${scene.scoringResolution ? " is-scoring" : ""}" data-toggle-port-structure role="button" tabindex="0" aria-label="${escapeAttribute(action)}" aria-pressed="${isStructure}">
      <circle class="port-cover__shadow" cx="${scene.cover.cx}" cy="${scene.cover.cy + 5}" r="${radius + 4}"></circle>
      <circle class="port-cover__rim" cx="${scene.cover.cx}" cy="${scene.cover.cy}" r="${radius}"></circle>
      <circle class="port-cover__body" cx="${scene.cover.cx}" cy="${scene.cover.cy}" r="${Math.max(radius - 10, 48)}"></circle>
      ${renderCoverScoring(scene.scoringResolution, scene.cover) || `
        <text class="port-cover__title" x="${scene.cover.cx}" y="${scene.cover.cy - 7}">${escapeAttribute(title)}</text>
        <text class="port-cover__action" x="${scene.cover.cx}" y="${scene.cover.cy + 20}">${escapeAttribute(action)}</text>`}
    </g>`;
}

/** Serialización SVG verificable sin DOM artificial. */
export function renderPortSvgMarkup(scene) {
  const focusActive = scene.nodeFocus !== null;
  const fullStructure = scene.showStructure;
  const routeOnly = scene.visualState === "route";
  const renderedThreads = fullStructure ? scene.threads : [];
  const routeThreads = routeOnly
    ? scene.threads.filter((thread) => thread.isTopologyHighlighted)
    : [];
  const renderedBridges = fullStructure
    ? scene.bridges
    : routeOnly
      ? scene.bridges.filter((bridge) => bridge.isTopologyHighlighted)
      : [];
  const renderedHubs = fullStructure
    ? scene.hubs
    : routeOnly
      ? scene.hubs.filter((hub) => hub.isTopologyHighlighted || hub.isTopologyRoot)
      : scene.hubs.filter((hub) =>
          hub.isLive || hub.isDecisionOwner || hub.isScoringTerm
        );
  const showIncidences = fullStructure || routeOnly;
  return `
    <svg class="port-graph is-${scene.visualState}" viewBox="${scene.viewBox}" role="group" aria-labelledby="port-title port-description" preserveAspectRatio="xMidYMid meet">
      <title id="port-title">Vista experimental de Puertos</title>
      <desc id="port-description">Siete macro-nodos fijos. Los hilos son fichas; las costuras interiores muestran qué incidencias continúan. Activa un recorrido o abre un valor para verlo sin interferencias.</desc>
      <g class="port-scene-base">
        <ellipse class="port-orbit" cx="${scene.orbit.cx}" cy="${scene.orbit.cy}" rx="${scene.orbit.rx}" ry="${scene.orbit.ry}"></ellipse>
        <g class="port-threads">${renderedThreads.map(renderThread).join("")}</g>
        ${renderCover(scene)}
        <g class="port-route-threads">${routeThreads.map(renderThread).join("")}</g>
        <g class="port-node-shells">${scene.nodes.map(renderNodeShell).join("")}</g>
        <g class="port-bridges">${renderedBridges.map(renderBridge).join("")}</g>
        <g class="port-nodes">${scene.nodes.map((node) => renderNode(node, node.value === scene.expandedNodeValue, scene.hubs.some((hub) => hub.value === node.value), { showIncidences })).join("")}</g>
        <g class="port-double-hubs">${renderedHubs.map(renderHub).join("")}</g>
        <g class="port-open-targets">${focusActive ? "" : scene.openTargets.map((target) => renderOpenTarget(target, scene.hasSelection)).join("")}</g>
      </g>
      ${renderNodeFocus(scene.nodeFocus, scene.hasSelection)}
    </svg>`;
}

function activateOnKeyboard(element, callback) {
  element.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      callback(event);
    }
  });
}

function boardSignature(portView) {
  const graph = portView.portGraph;
  return [
    ...graph.externalThreads.map((thread) => thread.id),
    ...graph.doubleHubs.map((hub) => hub.id),
    ...graph.internalBridges.map((bridge) => bridge.id),
  ].join("|");
}

export class PortRenderer {
  constructor(container) {
    if (!container) {
      throw new TypeError("PortRenderer requiere un contenedor.");
    }
    this.container = container;
    this.expandedNodeValue = null;
    this.inspectedRouteId = null;
    this.structureVisible = false;
    this.lastBoardSignature = null;
  }

  render(presentation, options = {}) {
    const currentSignature = boardSignature(presentation.portView);
    if (
      this.lastBoardSignature !== null &&
      currentSignature !== this.lastBoardSignature
    ) {
      this.expandedNodeValue = null;
      this.inspectedRouteId = null;
      this.structureVisible = false;
    }
    this.lastBoardSignature = currentSignature;

    const scene = createPortScene(presentation.portView, {
      selectedDominoId: presentation.selectedDominoId,
      legalTargets: presentation.selectedLegalTargets,
      inspectedStructureId: presentation.inspectedStructureId,
      inspectedPlacementId: presentation.inspectedPlacementId,
      inspectedRouteId: this.inspectedRouteId,
      expandedNodeValue: this.expandedNodeValue,
      showStructure: this.structureVisible,
      layout: this.container.clientWidth >= 760
        ? PORT_SCENE_LAYOUTS.WIDE
        : PORT_SCENE_LAYOUTS.COMPACT,
      scoringResolution: presentation.scoringResolution ?? null,
    });
    const startMarkup = scene.canStart
      ? `<div class="start-action"><p>El tablero aún está vacío.</p><button type="button" class="primary-action" data-start-action>Jugar ficha seleccionada</button></div>`
      : "";
    this.container.innerHTML = `${renderPortSvgMarkup(scene)}${startMarkup}${renderPortNodeInspectorMarkup(scene.nodeInspector)}`;

    const targetById = new Map(scene.openTargets.map((target) => [target.id, target]));
    const activateNode = (value) => {
      this.expandedNodeValue = this.expandedNodeValue === value ? null : value;
      this.structureVisible = false;
      this.inspectedRouteId = null;
      this.render(presentation, options);
    };
    const activateRoute = (routeId) => {
      this.inspectedRouteId = this.inspectedRouteId === routeId ? null : routeId;
      this.expandedNodeValue = null;
      this.structureVisible = false;
      this.render(presentation, options);
    };
    const clearRoute = () => {
      if (presentation.inspectedStructureId !== null) {
        options.onClearInspection?.();
        return;
      }
      this.inspectedRouteId = null;
      this.render(presentation, options);
    };
    const toggleStructure = () => {
      if (scene.visualState === "route") {
        clearRoute();
        return;
      }
      this.structureVisible = !this.structureVisible;
      this.expandedNodeValue = null;
      this.inspectedRouteId = null;
      this.render(presentation, options);
    };

    for (const element of this.container.querySelectorAll(".port-macro-node")) {
      const activate = () => activateNode(Number(element.dataset.nodeValue));
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }
    for (const element of this.container.querySelectorAll("[data-route-id]:not(.port-open-target)")) {
      const activate = (event) => {
        event?.stopPropagation();
        activateRoute(element.dataset.routeId);
      };
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }
    for (const element of this.container.querySelectorAll(".port-double-hub")) {
      const activate = (event) => {
        event.stopPropagation();
        activateNode(Number(element.dataset.nodeValue));
      };
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }
    for (const element of this.container.querySelectorAll(".port-open-target")) {
      const target = targetById.get(element.dataset.targetId);
      const activate = (event) => {
        event?.stopPropagation();
        if (target.isLegal) {
          options.onTarget?.(target);
          return;
        }
        activateRoute(target.topology.structureId);
      };
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }
    this.container.querySelector("[data-start-action]")?.addEventListener(
      "click",
      () => options.onStart?.({ kind: "START" }),
    );
    for (const element of this.container.querySelectorAll("[data-close-port-node]")) {
      const close = (event) => {
        event?.stopPropagation();
        this.expandedNodeValue = null;
        this.render(presentation, options);
      };
      element.addEventListener("click", close);
      activateOnKeyboard(element, close);
    }
    for (const element of this.container.querySelectorAll("[data-toggle-port-structure]")) {
      element.addEventListener("click", toggleStructure);
      activateOnKeyboard(element, toggleStructure);
    }
    for (const element of this.container.querySelectorAll(
      ".port-graph, [data-port-node-inspector]",
    )) {
      element.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
          return;
        }
        if (this.expandedNodeValue !== null) {
          event.preventDefault();
          this.expandedNodeValue = null;
          this.render(presentation, options);
          return;
        }
        if (presentation.inspectedStructureId !== null) {
          event.preventDefault();
          options.onClearInspection?.();
          return;
        }
        if (this.inspectedRouteId !== null) {
          event.preventDefault();
          this.inspectedRouteId = null;
          this.render(presentation, options);
          return;
        }
        if (this.structureVisible) {
          event.preventDefault();
          this.structureVisible = false;
          this.render(presentation, options);
        }
      });
    }
    return scene;
  }
}
