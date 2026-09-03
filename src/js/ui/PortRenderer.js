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
    item.isTopologyHighlighted ? "is-topology-highlighted" : "",
    item.isTopologyRoot ? "is-topology-root" : "",
    item.isTopologyDimmed ? "is-topology-dimmed" : "",
    item.isScoringTerm ? "is-scoring-term" : "",
  ].filter(Boolean).join(" ");
}

function renderThread(thread) {
  const label = `Ficha ${thread.dominoId.replace("-", "|")}, ${thread.topology.region === "main" ? "línea principal" : thread.topology.structureLabel}`;
  return `
    <g class="port-thread ${topologyClasses(thread)}" data-placement-id="${escapeAttribute(thread.placementId)}" role="button" tabindex="0" aria-label="${escapeAttribute(label)}">
      <path class="port-thread__hit" d="${thread.path}"></path>
      <path class="port-thread__cord" d="${thread.path}"></path>
    </g>`;
}

function renderBridge(bridge) {
  const label = `Continuidad por el valor ${bridge.value}, ${bridge.region === "main" ? "principal" : "ramificación"}`;
  return `
    <g class="port-bridge ${topologyClasses(bridge)}" data-connection-id="${escapeAttribute(bridge.connectionId)}" data-structure-id="${escapeAttribute(bridge.familyId ?? "main")}" role="button" tabindex="0" aria-label="${escapeAttribute(label)}">
      <path class="port-bridge__hit" d="${bridge.path}"></path>
      <path class="port-bridge__stitch" d="${bridge.path}"></path>
    </g>`;
}

function renderHub(hub) {
  const classes = [
    hub.isSpecial ? "is-special" : "is-ordinary",
    topologyClasses(hub),
  ].join(" ");
  const socketMarkup = hub.sockets.map((socket) => `
    <circle class="port-double-hub__socket${socket.connectionId ? " is-used" : ""}${socket.isOpenEnd ? " is-open" : ""}" cx="${socket.x}" cy="${socket.y}" r="6" data-board-port-id="${escapeAttribute(socket.boardPortId)}"></circle>`).join("");
  return `
    <g class="port-double-hub ${classes}" data-placement-id="${escapeAttribute(hub.placementId)}" data-node-value="${hub.value}" role="button" tabindex="0" aria-label="Chancho ${hub.value}|${hub.value}, ${hub.isSpecial ? "especial con cuatro sockets" : "ordinario con dos sockets"}; abrir detalle del valor ${hub.value}">
      <circle class="port-double-hub__body" cx="${hub.x}" cy="${hub.y}" r="${hub.isSpecial ? 25 : 20}"></circle>
      <text class="port-double-hub__mark" x="${hub.x}" y="${hub.y}">${hub.isSpecial ? "×4" : "═"}</text>
      ${socketMarkup}
    </g>`;
}

function renderNode(node, isExpanded, hasDoubleHub) {
  const ports = node.ordinaryPorts.map((port) => `
    <circle class="port-incidence ${port.state === "PLAYED" ? "is-played" : "is-potential"}${port.isOpenEnd ? " is-open" : ""}" cx="${port.x}" cy="${port.y}" r="${port.state === "PLAYED" ? 5.5 : 3.2}" data-port-id="${escapeAttribute(port.id)}"></circle>`).join("");
  return `
    <g class="port-macro-node${isExpanded ? " is-expanded" : ""}${hasDoubleHub ? " has-double-hub" : ""}" data-node-value="${node.value}" role="button" tabindex="0" aria-pressed="${isExpanded}" aria-label="Valor ${node.value}; ${node.ordinaryPorts.filter((port) => port.state === "PLAYED").length} incidencias jugadas; abrir detalle">
      <circle class="port-macro-node__hit" cx="${node.x}" cy="${node.y}" r="67"></circle>
      <circle class="port-macro-node__outline" cx="${node.x}" cy="${node.y}" r="55"></circle>
      <text class="port-macro-node__value" x="${node.x}" y="${node.y - (hasDoubleHub ? 31 : 11)}">${node.value}</text>
      ${ports}
    </g>`;
}

function renderNodeShell(node) {
  return `<circle class="port-macro-node__body" cx="${node.x}" cy="${node.y}" r="55"></circle>`;
}

function renderOpenTarget(target, hasSelection) {
  const stateClass = target.isLegal
    ? "is-legal"
    : target.isIncompatible
      ? "is-incompatible"
      : "is-neutral";
  const option = target.optionIndex === null
    ? ""
    : `<text class="port-open-target__option" x="${target.x + 13}" y="${target.y - 12}">${target.optionIndex}</text>`;
  const structure = target.topology.region === "main"
    ? "principal"
    : target.topology.structureLabel;
  return `
    <g class="port-open-target ${stateClass} ${topologyClasses(target)}" data-target-id="${escapeAttribute(target.id)}" role="button" tabindex="0" aria-label="Extremo abierto de valor ${target.value}, ${escapeAttribute(structure)}${hasSelection ? target.isLegal ? "; compatible" : "; no compatible" : ""}">
      <circle class="port-open-target__hit" cx="${target.x}" cy="${target.y}" r="22"></circle>
      <circle class="port-open-target__halo" cx="${target.x}" cy="${target.y}" r="12"></circle>
      <circle class="port-open-target__core" cx="${target.x}" cy="${target.y}" r="5"></circle>
      ${option}
    </g>`;
}

export function renderPortNodeInspectorMarkup(inspector) {
  if (!inspector) {
    return "";
  }
  const bridges = inspector.bridges.length === 0
    ? "<li>Sin conexiones internas todavía.</li>"
    : inspector.bridges.map((bridge) =>
        `<li><strong>${escapeAttribute(bridge.firstLabel)}</strong> ↔ <strong>${escapeAttribute(bridge.secondLabel)}</strong> · ${bridge.region === "main" ? "principal" : "rama"}</li>`
      ).join("");
  const hubs = inspector.hubs.map((hub) =>
    `<p class="port-node-inspector__hub">Chancho ${escapeAttribute(hub.dominoId.replace("-", "|"))}: ${hub.isSpecial ? "especial" : "ordinario"} · ${hub.usedSockets}/${hub.capacity} conexiones</p>`
  ).join("");
  return `
    <aside class="port-node-inspector" data-port-node-inspector aria-label="Detalle del valor ${inspector.value}">
      <div>
        <p class="port-node-inspector__kicker">Saco abierto</p>
        <h3>Valor ${inspector.value}</h3>
        <p>${inspector.playedPortCount} de 6 incidencias ordinarias jugadas.</p>
        ${hubs}
        <ul>${bridges}</ul>
      </div>
      <button type="button" data-close-port-node aria-label="Cerrar detalle del valor ${inspector.value}">Cerrar</button>
    </aside>`;
}

/** Serialización SVG verificable sin DOM artificial. */
export function renderPortSvgMarkup(scene) {
  return `
    <svg class="port-graph" viewBox="${scene.viewBox}" role="group" aria-labelledby="port-title port-description" preserveAspectRatio="xMidYMid meet">
      <title id="port-title">Vista experimental de Puertos</title>
      <desc id="port-description">Siete macro-nodos fijos, uno por valor. Los hilos exteriores son fichas y las costuras interiores muestran qué incidencias continúan entre sí.</desc>
      <ellipse class="port-orbit" cx="${scene.orbit.cx}" cy="${scene.orbit.cy}" rx="${scene.orbit.rx}" ry="${scene.orbit.ry}"></ellipse>
      <g class="port-threads">${scene.threads.map(renderThread).join("")}</g>
      <g class="port-node-shells">${scene.nodes.map(renderNodeShell).join("")}</g>
      <g class="port-bridges">${scene.bridges.map(renderBridge).join("")}</g>
      <g class="port-nodes">${scene.nodes.map((node) => renderNode(node, node.value === scene.expandedNodeValue, scene.hubs.some((hub) => hub.value === node.value))).join("")}</g>
      <g class="port-double-hubs">${scene.hubs.map(renderHub).join("")}</g>
      <g class="port-open-targets">${scene.openTargets.map((target) => renderOpenTarget(target, scene.hasSelection)).join("")}</g>
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

export class PortRenderer {
  constructor(container) {
    if (!container) {
      throw new TypeError("PortRenderer requiere un contenedor.");
    }
    this.container = container;
    this.expandedNodeValue = null;
  }

  render(presentation, options = {}) {
    const scene = createPortScene(presentation.portView, {
      selectedDominoId: presentation.selectedDominoId,
      legalTargets: presentation.selectedLegalTargets,
      inspectedStructureId: presentation.inspectedStructureId,
      inspectedPlacementId: presentation.inspectedPlacementId,
      expandedNodeValue: this.expandedNodeValue,
      layout: this.container.clientWidth >= 720
        ? PORT_SCENE_LAYOUTS.WIDE
        : PORT_SCENE_LAYOUTS.COMPACT,
      scoringResolution: presentation.scoringResolution ?? null,
    });
    const startMarkup = scene.canStart
      ? `<div class="start-action"><p>El tablero aún está vacío.</p><button type="button" class="primary-action" data-start-action>Jugar ficha seleccionada</button></div>`
      : "";
    this.container.innerHTML = `${renderPortSvgMarkup(scene)}${startMarkup}${renderPortNodeInspectorMarkup(scene.nodeInspector)}`;

    const targetById = new Map(scene.openTargets.map((target) => [target.id, target]));
    const threadByPlacementId = new Map(
      scene.threads.map((thread) => [thread.placementId, thread]),
    );
    const hubByPlacementId = new Map(
      scene.hubs.map((hub) => [hub.placementId, hub]),
    );
    const activateNode = (value) => {
      this.expandedNodeValue = this.expandedNodeValue === value ? null : value;
      this.render(presentation, options);
    };
    for (const element of this.container.querySelectorAll(".port-macro-node")) {
      const activate = () => activateNode(Number(element.dataset.nodeValue));
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }
    for (const element of this.container.querySelectorAll(".port-thread")) {
      const activate = () => options.onInspectEdge?.(
        threadByPlacementId.get(element.dataset.placementId),
      );
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }
    for (const element of this.container.querySelectorAll(".port-double-hub")) {
      const activate = () => {
        options.onInspectEdge?.(
          hubByPlacementId.get(element.dataset.placementId),
        );
        activateNode(Number(element.dataset.nodeValue));
      };
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }
    for (const element of this.container.querySelectorAll(".port-bridge")) {
      const activate = () => options.onInspectStructure?.(
        element.dataset.structureId,
      );
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }
    for (const element of this.container.querySelectorAll(".port-open-target")) {
      const target = targetById.get(element.dataset.targetId);
      const activate = () => target.isLegal
        ? options.onTarget?.(target)
        : options.onInspectStructure?.(target.topology.familyId ?? "main");
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }
    this.container.querySelector("[data-start-action]")?.addEventListener(
      "click",
      () => options.onStart?.({ kind: "START" }),
    );
    this.container.querySelector("[data-close-port-node]")?.addEventListener(
      "click",
      () => activateNode(this.expandedNodeValue),
    );
    for (const element of this.container.querySelectorAll(
      ".port-graph, [data-port-node-inspector]",
    )) {
      element.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && this.expandedNodeValue !== null) {
          event.preventDefault();
          this.expandedNodeValue = null;
          this.render(presentation, options);
        }
      });
    }
    return scene;
  }
}
