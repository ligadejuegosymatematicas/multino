import {
  createGraphScene,
  GRAPH_SCENE_LAYOUTS,
} from "./GraphScene.js";

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
    edge.familyTone === null ? "" : `family-tone-${edge.familyTone}`,
    edge.topology.isSpecialDouble ? "is-special-double" : "",
    edge.isInspected ? "is-inspected" : "",
    edge.isTopologyHighlighted ? "is-topology-highlighted" : "",
    edge.isTopologyRoot ? "is-topology-root" : "",
    edge.isTopologyDimmed ? "is-topology-dimmed" : "",
    edge.isFamilyClosed ? "is-family-closed" : "",
    edge.isScoringTerm ? "is-scoring-term" : "",
  ].filter(Boolean).join(" ");
}

function describeTopology(topology) {
  return topology.region === "main"
    ? `recorrido inicial, posición ${topology.order}`
    : `brazo ${topology.armIndex} del chancho ramificador, posición ${topology.depth}`;
}

function describeRootedBranches(topology) {
  if (topology.branchFamily === null) {
    return "";
  }
  return "; es el chancho ramificador";
}

function renderFamilyRootMarker(edge) {
  const family = edge.topology.branchFamily;
  if (!family) {
    return "";
  }
  if (edge.isFamilyClosed && !edge.isTopologyRoot) {
    return "";
  }
  const familyTone = family.familyIndex % 4;
  const label = `Inspeccionar brazos del chancho ramificador ${edge.a}-${edge.b}; ${family.arms.filter((arm) => arm.isOccupied).length} de 2 brazos laterales iniciados`;
  return `
    <g class="graph-family-root family-tone-${familyTone}${edge.isTopologyRoot ? " is-inspected" : ""}${edge.isTopologyDimmed ? " is-dimmed" : ""}" transform="translate(${edge.labelX + 16} ${edge.labelY})" data-family-id="${escapeAttribute(family.id)}" data-family-code="${escapeAttribute(family.code)}" role="button" tabindex="0" aria-pressed="${edge.isTopologyRoot}" aria-label="${escapeAttribute(label)}">
      <circle class="graph-family-root__hit" r="22"></circle>
      <circle class="graph-family-root__badge" r="9"></circle>
    </g>`;
}

function renderEdge(edge) {
  const label = `Ficha ${edge.a}-${edge.b}, ${describeTopology(edge.topology)}${describeRootedBranches(edge.topology)}, jugada por ${edge.playerId} en la acción ${edge.turnNumber}`;
  return `
    <g class="graph-edge ${getTopologyClasses(edge)}" data-placement-id="${escapeAttribute(edge.placementId)}" data-region="${edge.topology.region}" data-family-id="${escapeAttribute(edge.topology.familyId ?? "")}" data-special-double="${edge.topology.isSpecialDouble}" role="button" tabindex="0" aria-pressed="${edge.isInspected}" aria-label="${escapeAttribute(label)}">
      <path class="graph-edge__hit" d="${edge.path}"></path>
      <path class="graph-edge__line" d="${edge.path}"></path>
    </g>`;
}

function renderLoop(loop) {
  const label = `Chancho ${loop.a}-${loop.b}, ${describeTopology(loop.topology)}, ${loop.topology.isSpecialDouble ? "especial" : "ordinario"}${describeRootedBranches(loop.topology)}, jugado por ${loop.playerId} en la acción ${loop.turnNumber}`;
  return `
    <g class="graph-loop ${getTopologyClasses(loop)}" data-placement-id="${escapeAttribute(loop.placementId)}" data-region="${loop.topology.region}" data-family-id="${escapeAttribute(loop.topology.familyId ?? "")}" data-special-double="${loop.topology.isSpecialDouble}" role="button" tabindex="0" aria-pressed="${loop.isInspected}" aria-label="${escapeAttribute(label)}">
      <path class="graph-loop__hit" d="${loop.path}"></path>
      <path class="graph-loop__shape" d="${loop.path}"></path>
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
    target.familyTone === null ? "" : `family-tone-${target.familyTone}`,
    target.topology.branchState === "POTENTIAL" ? "is-potential-arm" : "",
    target.topology.branchState === "STARTED" ? "is-started-arm" : "",
    target.isTopologyHighlighted ? "is-topology-highlighted" : "",
    target.isTopologyDimmed ? "is-topology-dimmed" : "",
    target.isScoringTerm ? "is-scoring-term" : "",
  ].filter(Boolean).join(" ");
  const optionMarkup = target.optionIndex === null
    ? ""
    : `<text class="open-target__option-index" x="${target.endX + 13}" y="${target.endY - 12}" aria-hidden="true">${target.optionIndex}</text>`;
  return `
    <g class="open-target ${classes}" data-target-id="${escapeAttribute(target.id)}" data-region="${target.topology.region}" data-family-id="${escapeAttribute(target.topology.familyId ?? "")}" data-arm-index="${escapeAttribute(target.topology.armIndex ?? "")}" data-branch-state="${escapeAttribute(target.topology.branchState ?? "")}" data-structure-code="${escapeAttribute(target.topology.structureCode)}" role="button" tabindex="0" aria-disabled="false" aria-label="${escapeAttribute(target.accessibleLabel)}">
      <path class="open-target__hit" d="${target.path}"></path>
      <path class="open-target__curve" d="${target.path}"></path>
      <circle class="open-target__end" cx="${target.endX}" cy="${target.endY}" r="10"></circle>
      ${optionMarkup}
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
    <g class="graph-vertex ${stateClass}${vertex.isScoringTerm ? " is-scoring-term" : ""}" data-vertex-value="${vertex.value}" role="button" tabindex="${count > 0 ? "0" : "-1"}" aria-disabled="${count > 0 ? "false" : "true"}" aria-label="Valor ${vertex.value}${actionHint}">
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
      <desc id="graph-description">Siete valores fijos. Cada curva terminal representa un destino abierto individual. El chancho ramificador se distingue de los dobles ordinarios y sus brazos conservan targets internos distintos.</desc>
      <ellipse class="graph-orbit" cx="${scene.orbit.cx}" cy="${scene.orbit.cy}" rx="${scene.orbit.rx}" ry="${scene.orbit.ry}"></ellipse>
      <g class="graph-edges">${scene.edges.map(renderEdge).join("")}</g>
      <g class="graph-loops">${scene.loops.map(renderLoop).join("")}</g>
      <g class="graph-family-roots">${scene.loops.map(renderFamilyRootMarker).join("")}</g>
      <g class="graph-open-targets">${scene.openTargets.map((target) => renderOpenTarget(target, scene.hasSelection)).join("")}</g>
      <g class="graph-vertices">${scene.vertices.map((vertex) => renderVertex(vertex, scene.hasSelection)).join("")}</g>
    </svg>`;
}

function describeDoubleRole(doubleRole) {
  switch (doubleRole) {
    case "BRANCHING_DOUBLE":
      return "Chancho ramificador";
    case "ORDINARY_DOUBLE":
      return "Chancho ordinario";
    default:
      return null;
  }
}

export function renderTopologyInspectionMarkup(inspection) {
  if (!inspection) {
    return "";
  }
  const topology = inspection.topology;
  const isFamily = inspection.kind === "family";
  const startedArms = inspection.arms.filter((arm) => arm.isOccupied).length;
  const title = isFamily
    ? "Brazos del chancho ramificador"
    : "Recorrido inicial";
  const region = isFamily
    ? `Nace del chancho ${inspection.rootDominoId?.replace("-", "|") ?? "indicado"}. ${startedArms} brazo${startedArms === 1 ? " iniciado" : "s iniciados"} · ${2 - startedArms} potencial${2 - startedArms === 1 ? "" : "es"}.`
    : topology
      ? `Ficha ${inspection.dominoId.replace("-", "|")} · posición ${topology.order}.`
      : "Recorrido principal completo.";
  const inspectedDomino = isFamily && topology
    ? `<p class="topology-inspector__selection">Ficha inspeccionada: ${escapeAttribute(inspection.dominoId.replace("-", "|"))} · brazo ${topology.armIndex} · posición ${topology.depth}.</p>`
    : "";
  const doubleRole = topology
    ? describeDoubleRole(topology.doubleRole)
    : null;
  const doubleDetails = doubleRole
    ? `<p class="topology-inspector__double"><strong>${doubleRole}</strong><span>Conexiones: ${topology.connectionCount}/${topology.connectionCapacity}</span>${topology.isSpecialDouble ? `<span>Ramas iniciadas: ${topology.startedBranchCount}/2</span>` : ""}</p>`
    : "";

  return `
    <aside class="topology-inspector" data-topology-inspection data-inspection-kind="${inspection.kind}" aria-label="Inspección de ${escapeAttribute(title)}">
      <div>
        <p class="topology-inspector__kicker">Lectura de la partida</p>
        <h3>${escapeAttribute(title)}</h3>
        <p class="topology-inspector__region">${escapeAttribute(region)}</p>
        ${inspectedDomino}
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
      onInspectStructure,
      onClearInspection,
      onMessage,
    } = {},
  ) {
    const scene = createGraphScene(presentation.view, {
      selectedDominoId: presentation.selectedDominoId,
      legalTargets: presentation.selectedLegalTargets,
      inspectedStructureId: presentation.inspectedStructureId,
      inspectedPlacementId: presentation.inspectedPlacementId,
      layout: this.container.clientWidth >= 720
        ? GRAPH_SCENE_LAYOUTS.WIDE
        : GRAPH_SCENE_LAYOUTS.COMPACT,
      scoringResolution: presentation.scoringResolution ?? null,
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
    for (const element of this.container.querySelectorAll(".open-target")) {
      const target = targetById.get(element.dataset.targetId);
      const activate = () => target.isLegal
        ? onTarget?.(target)
        : onInspectStructure?.(target.topology.familyId ?? "main");
      element.addEventListener("click", activate);
      activateOnKeyboard(element, activate);
    }

    for (const element of this.container.querySelectorAll(
      ".graph-family-root",
    )) {
      const activate = () => onInspectStructure?.(element.dataset.familyId);
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
