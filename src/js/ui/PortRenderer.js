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
    return "recorrido de la ronda";
  }
  return `recorrido ${topology.armIndex} conectado al doble central`;
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
  const label = `Continuidad por el valor ${bridge.value}, ${bridge.region === "main" ? "recorrido base" : `brazo ${bridge.armIndex} del doble central`}; inspeccionar recorrido`;
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
    <g class="port-double-hub ${classes}" data-placement-id="${escapeAttribute(hub.placementId)}" data-node-value="${hub.value}" role="button" tabindex="0" aria-label="Doble ${hub.value}|${hub.value}, ${hub.isSpecial ? "central con hasta cuatro conexiones" : "ordinario con dos conexiones"}; abrir detalle del valor ${hub.value}">
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
  const stateClasses = [
    node.isCompatible ? "is-compatible" : "",
    node.isInSelectedDomino ? "is-in-selected-domino" : "",
    node.isTargetChoiceOpen ? "is-target-choice" : "",
    node.isStrategicInspected ? "is-strategic-inspected" : "",
    node.openTargetCount > 0 ? "has-open-targets" : "has-no-open-targets",
    node.ramifier ? "has-ramifier" : "",
    node.ramifier?.isSaturated ? "is-ramifier-saturated" : "",
    node.isScoringSource ? "is-scoring-source" : "",
    node.isScoringFeedbackSource ? "is-scoring-feedback-source" : "",
    node.isDecisionPreview ? "is-decision-preview" : "",
  ].filter(Boolean).join(" ");
  return `
    <g class="port-macro-node-shell ${stateClasses}" aria-hidden="true">
      <circle class="port-macro-node__playability-ring" cx="${node.x}" cy="${node.y}" r="68"></circle>
      <circle class="port-macro-node__active-ring" cx="${node.x}" cy="${node.y}" r="69"></circle>
      <circle class="port-macro-node__shadow" cx="${node.x}" cy="${node.y + 4}" r="64"></circle>
      <circle class="port-macro-node__rim" cx="${node.x}" cy="${node.y}" r="63"></circle>
      <circle class="port-macro-node__body" cx="${node.x}" cy="${node.y}" r="57"></circle>
      <circle class="port-macro-node__inner" cx="${node.x}" cy="${node.y}" r="48"></circle>
      <circle class="port-macro-node__scoring-ring" cx="${node.x}" cy="${node.y}" r="51"></circle>
    </g>`;
}

function renderRamifierStatus(node) {
  if (!node.ramifier) {
    return "";
  }
  const socketPosition = {
    "main:1": { x: -13, y: 49, axis: "continuity" },
    "main:2": { x: 13, y: 49, axis: "continuity" },
    "branch:1": { x: 0, y: 38, axis: "lateral" },
    "branch:2": { x: 0, y: 60, axis: "lateral" },
  };
  const sockets = node.ramifier.sockets.map((socket) => {
    const position = socketPosition[socket.portId];
    const classes = [
      "port-ramifier__socket",
      `is-${position.axis}`,
      socket.isUsed ? "is-used" : "",
      socket.isAvailable ? "is-available" : "",
      socket.isLocked ? "is-locked" : "",
    ].filter(Boolean).join(" ");
    return `<circle class="${classes}" cx="${node.x + position.x}" cy="${node.y + position.y}" r="3.2"></circle>`;
  }).join("");
  return `
    <g class="port-ramifier" aria-hidden="true" data-ramifier-phase="${node.ramifier.phase}">
      <path class="port-ramifier__mark is-continuity" d="M ${node.x - 13} ${node.y + 49} L ${node.x + 13} ${node.y + 49}"></path>
      <path class="port-ramifier__mark is-lateral${node.ramifier.lateralPortsUnlocked ? " is-unlocked" : " is-locked"}" d="M ${node.x} ${node.y + 38} L ${node.x} ${node.y + 60}"></path>
      ${sockets}
    </g>`;
}

function renderScoringMultiplicity(node) {
  const previewActive = node.previewScoringMultiplicity !== null;
  const displayedMultiplicity = previewActive
    ? node.previewScoringMultiplicity
    : node.scoringMultiplicity;
  if (displayedMultiplicity === 0 && node.scoringMultiplicity === 0) return "";
  const transition = previewActive &&
      displayedMultiplicity !== node.scoringMultiplicity
    ? `×${node.scoringMultiplicity}→×${displayedMultiplicity}`
    : `×${displayedMultiplicity}`;
  return `
    <g class="port-macro-node__scoring-badge${previewActive ? " is-preview" : ""}${displayedMultiplicity === 0 ? " is-removing" : ""}" data-scoring-multiplicity="${displayedMultiplicity}" data-current-scoring-multiplicity="${node.scoringMultiplicity}"${node.isScoringFeedbackSource ? ` data-scoring-anchor-value="${node.value}"` : ""} aria-hidden="true">
      <rect x="${node.x - 88}" y="${node.y - 68}" width="76" height="48" rx="24"></rect>
      <text x="${node.x - 50}" y="${node.y - 44}">${transition}</text>
    </g>`;
}

function renderNode(node, isExpanded, hasDoubleHub, { showIncidences = false } = {}) {
  const incidences = showIncidences
    ? node.ordinaryPorts.map((port) => renderIncidence(port)).join("")
    : "";
  const compatibilityLabel = node.isCompatible
    ? `; ${node.strategicDecisionCount} ${node.strategicDecisionCount === 1 ? "decisión compatible" : "decisiones compatibles"} en ${node.physicalCompatibleTargetCount} ${node.physicalCompatibleTargetCount === 1 ? "lugar" : "lugares"}`
    : "";
  const ramifierLabel = node.ramifier
    ? `; doble central con ${node.ramifier.connectionCount} de 4 conexiones${node.ramifier.isSaturated ? "; saturado" : ""}`
    : "";
  const displayedScoringMultiplicity = node.previewScoringMultiplicity ??
    node.scoringMultiplicity;
  const scoringLabel = displayedScoringMultiplicity > 0
    ? `; aporta ${displayedScoringMultiplicity} ${displayedScoringMultiplicity === 1 ? "vez" : "veces"} a Σ${node.previewScoringMultiplicity !== null ? " en la previsualización" : ""}`
    : "; no aporta actualmente a Σ";
  return `
    <g class="port-macro-node${isExpanded ? " is-expanded" : ""}${hasDoubleHub ? " has-double-hub" : ""}${node.isScoringFeedbackSource ? " is-scoring-feedback-source" : ""}${node.isDecisionPreview ? " is-decision-preview" : ""}" data-node-value="${node.value}" data-open-target-count="${node.openTargetCount}" data-decision-count="${node.strategicDecisionCount}" data-physical-target-count="${node.physicalCompatibleTargetCount}" data-scoring-multiplicity="${displayedScoringMultiplicity}" data-played-tile-count="${node.playedTileCount}"${node.previewScoringMultiplicity !== null ? ` data-current-scoring-multiplicity="${node.scoringMultiplicity}"` : ""} role="button" tabindex="0" aria-pressed="${isExpanded || node.isStrategicInspected}" aria-label="Valor ${node.value}; ${node.playedTileCount} de 7 fichas salieron; ${node.openTargetCount} ${node.openTargetCount === 1 ? "lugar abierto" : "lugares abiertos"}${scoringLabel}${compatibilityLabel}${ramifierLabel}">
      <circle class="port-macro-node__hit" cx="${node.x}" cy="${node.y}" r="70"></circle>
      <text class="port-macro-node__value" x="${node.x}" y="${node.y - 5}">${node.value}</text>
      <g class="port-macro-node__target-badge${node.displayTargetCount > 0 ? " has-targets" : " is-zero"}${node.isCompatible ? " is-compatible" : ""}" data-semantic="playability">
        <rect x="${node.x + 12}" y="${node.y - 68}" width="76" height="48" rx="24"></rect>
        <text x="${node.x + 50}" y="${node.y - 44}">↗ ${node.displayTargetCount}</text>
      </g>
      ${node.isCompatible && node.physicalCompatibleTargetCount > node.strategicDecisionCount
        ? `<text class="port-macro-node__equivalent-places" x="${node.x + 49}" y="${node.y - 22}">×${node.physicalCompatibleTargetCount} lugares</text>`
        : ""}
      ${renderScoringMultiplicity(node)}
      <text class="port-macro-node__played" data-semantic="history" x="${node.x}" y="${node.y + 34}">▣ ${node.playedTileCount}/${node.totalTileCount}</text>
      ${renderRamifierStatus(node)}
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
        `<li><strong>${escapeAttribute(bridge.firstLabel)}</strong> ↔ <strong>${escapeAttribute(bridge.secondLabel)}</strong> · continuidad real</li>`
      ).join("");
  const hubs = inspector.hubs.map((hub) =>
    `<p class="port-node-inspector__hub">Doble ${escapeAttribute(hub.dominoId.replace("-", "|"))}: ${hub.isSpecial ? "central" : "ordinario"} · ${hub.usedSockets}/${hub.capacity} conexiones</p>`
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

export function renderPortStrategicInspectorMarkup(inspector) {
  if (!inspector) {
    return "";
  }
  const ramifier = inspector.ramifier
    ? `<p><strong>Doble central:</strong> ${inspector.ramifier.connectionCount}/4 conexiones${inspector.ramifier.isSaturated ? " · saturado" : ""}</p>`
    : "";
  const scoring = inspector.isScoringSource
    ? `<p class="port-strategic-inspector__scoring"><strong>Aporte a Σ:</strong> ${inspector.scoringTerms.map((term) => escapeAttribute(term.label)).join(" + ")}</p>`
    : `<p class="port-strategic-inspector__muted">Este valor no aporta actualmente a Σ.</p>`;
  return `
    <aside class="port-strategic-inspector" data-port-strategic-inspector role="dialog" aria-label="Detalle estratégico del valor ${inspector.value}">
      <button type="button" class="port-strategic-inspector__close" data-close-port-strategic aria-label="Cerrar detalle">×</button>
      <p class="port-strategic-inspector__kicker">Valor ${inspector.value}</p>
      <p><strong>Fichas con ${inspector.value} que salieron:</strong> ${inspector.playedTileCount}/${inspector.totalTileCount}</p>
      <p><strong>Lugares para jugar:</strong> ${inspector.openTargetCount}</p>
      ${ramifier}
      ${scoring}
    </aside>`;
}

function renderCurrentScoring(scoring, cover, { pending = false } = {}) {
  if (!scoring) {
    return "";
  }
  if (pending) {
    return "";
  }
  const terms = scoring.terms;
  const chipGap = 10;
  const chipWidth = terms.length > 0
    ? Math.min(54, Math.max(36, 184 / terms.length))
    : 0;
  const totalWidth = terms.length > 0
    ? terms.length * chipWidth + (terms.length - 1) * chipGap
    : 0;
  const startX = cover.cx - totalWidth / 2 + chipWidth / 2;
  const chips = terms.length === 0
    ? `<text class="port-cover__empty-terms" x="${cover.cx}" y="${cover.cy - 25}">Sin términos</text>`
    : terms.map((term, index) => {
    const x = startX + index * (chipWidth + chipGap);
    return `
      <g class="port-cover__term">
        <rect x="${x - chipWidth / 2}" y="${cover.cy - 42}" width="${chipWidth}" height="34" rx="10"></rect>
        <text x="${x}" y="${cover.cy - 25}">${escapeAttribute(term.label)}</text>
      </g>`;
      }).join("");
  const expression = terms.length > 0
    ? `<text class="port-cover__current-expression" x="${cover.cx}" y="${cover.cy + 12}">${escapeAttribute(scoring.expression)}</text>`
    : "";
  return `
    <g class="port-cover__current-score" role="status" aria-label="Sigma se forma con ${escapeAttribute(scoring.expression)} y vale ${scoring.sum}">
      <text class="port-cover__kicker" x="${cover.cx}" y="${cover.cy - 67}">PUNTAS · Σ</text>
      ${chips}
      ${expression}
      <text class="port-cover__current-sum" x="${cover.cx}" y="${cover.cy + 54}">Σ = ${scoring.sum}</text>
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
      : null;
  const action = isRoute || isStructure ? "Volver a jugar" : "Ver estructura";
  const radius = isStructure ? 80 : scene.cover.radius;
  return `
    <g class="port-cover${isStructure ? " is-structure-control" : ""}${isRoute ? " is-route-cover" : ""}${scene.scoringResolution ? " is-scoring" : ""}">
      <circle class="port-cover__shadow" cx="${scene.cover.cx}" cy="${scene.cover.cy + 5}" r="${radius + 4}"></circle>
      <circle class="port-cover__rim" cx="${scene.cover.cx}" cy="${scene.cover.cy}" r="${radius}"></circle>
      <circle class="port-cover__body" cx="${scene.cover.cx}" cy="${scene.cover.cy}" r="${Math.max(radius - 10, 48)}"></circle>
      ${title
          ? `<text class="port-cover__title" x="${scene.cover.cx}" y="${scene.cover.cy - 7}">${escapeAttribute(title)}</text><text class="port-cover__action" x="${scene.cover.cx}" y="${scene.cover.cy + 20}">${escapeAttribute(action)}</text>`
          : renderCurrentScoring(scene.scoringPresentation, scene.cover, {
              pending: scene.scoringResolution !== null,
            })}
    </g>`;
}

export function renderPortStructureToggleMarkup(scene) {
  const isAnalytic = scene.showStructure || scene.visualState === "route";
  return `
    <button type="button" class="port-structure-toggle${isAnalytic ? " is-active" : ""}" data-toggle-port-structure aria-pressed="${scene.showStructure}">
      <span aria-hidden="true">${isAnalytic ? "←" : "⌘"}</span>
      ${isAnalytic ? "Volver a jugar" : "Ver estructura"}
    </button>`;
}

const PORT_DECISION_META = Object.freeze({
  start: { icon: "▶", title: "Jugar" },
  continue: { icon: "→", title: "Seguir punta" },
  "complete-cross": { icon: "┼", title: "Completar cruce" },
  "open-arm": { icon: "↗", title: "Abrir rama" },
});

function scoringChangeText(change) {
  if (change.after === 0) {
    return `Σ ${change.value} ×${change.before} → —`;
  }
  if (change.before === 0) {
    return `Σ ${change.value} ×${change.after}`;
  }
  return `Σ ${change.value} ×${change.before}→×${change.after}`;
}

function openTargetChangeText(changes) {
  const parts = changes.map((change) =>
    `${change.delta > 0 ? "+" : "−"}${change.value}${Math.abs(change.delta) > 1 ? `×${Math.abs(change.delta)}` : ""}`
  );
  return parts.length > 0 ? `Puntas ${parts.join(" · ")}` : null;
}

function scoringMultiplicitiesFromDecision(decision) {
  const multiplicities = Array.from({ length: 7 }, () => 0);
  for (const term of decision.outcome?.scoring?.terms ?? []) {
    if (
      Number.isSafeInteger(term.value) &&
      term.value >= 0 &&
      term.value <= 6 &&
      Number.isSafeInteger(term.factor) &&
      term.factor > 0
    ) {
      multiplicities[term.value] += term.factor;
    }
  }
  return multiplicities;
}

function badgeIdentity(badge) {
  return `${badge.kind}\u0000${badge.text}`;
}

export function createPortDecisionPresentation(decision) {
  const meta = PORT_DECISION_META[decision.decisionKind] ??
    PORT_DECISION_META.continue;
  const effects = decision.effects ?? {};
  const badges = [];
  const ramifierScoringChange = effects.ramifierScoringChange ?? null;
  for (const change of effects.scoringMultiplicityChanges ?? []) {
    if (change.value === ramifierScoringChange?.value) continue;
    badges.push({
      kind: "scoring",
      text: scoringChangeText(change),
      value: change.value,
    });
  }
  if (ramifierScoringChange) {
    badges.push({
      kind: "scoring-off",
      text: `Σ doble ×${ramifierScoringChange.before} → 0`,
      value: ramifierScoringChange.value,
    });
  }
  if ((effects.unlockedLateralCount ?? 0) > 0) {
    badges.push({
      kind: "playable",
      text: `↗ +${effects.unlockedLateralCount} salidas`,
    });
  }
  if (badges.length === 0) {
    const openTargets = openTargetChangeText(
      effects.openTargetChangesByValue ?? [],
    );
    if (openTargets) {
      badges.push({ kind: "structure", text: openTargets });
    }
  }
  if (effects.endsRound) {
    badges.push({ kind: "structure", text: "Cierra ronda" });
  }
  if (decision.physicalTargetCount > 1) {
    badges.push({
      kind: "places",
      text: `×${decision.physicalTargetCount} lugares equivalentes`,
    });
  }
  return {
    icon: meta.icon,
    title: meta.title,
    badges,
    visibleSignature: JSON.stringify({
      icon: meta.icon,
      title: meta.title,
      badges: badges.map(({ kind, text }) => ({ kind, text })),
    }),
  };
}

export function createPortDecisionPresentations(decisions) {
  return createPortDecisionChoicePresentation(decisions).options;
}

/**
 * Separa lo común de un conjunto de decisiones y deja en cada tarjeta solo la
 * consecuencia que realmente la distingue. No expone Σ ni puntos futuros.
 */
export function createPortDecisionChoicePresentation(decisions) {
  const rawPresentations = decisions.map(createPortDecisionPresentation);
  const crossDecision = decisions.find(
    (decision) => decision.decisionKind === "complete-cross",
  );
  const criticalDoubleChoice = crossDecision !== undefined &&
    decisions.some((decision) => decision.decisionKind === "continue");
  const doubleScoringBefore =
    crossDecision?.effects?.ramifierScoringChange?.before ?? 2;
  const commonBadgeIds = rawPresentations.length === 0
    ? new Set()
    : new Set(rawPresentations[0].badges.map(badgeIdentity));
  for (const presentation of rawPresentations.slice(1)) {
    const ownIds = new Set(presentation.badges.map(badgeIdentity));
    for (const identity of [...commonBadgeIds]) {
      if (!ownIds.has(identity)) commonBadgeIds.delete(identity);
    }
  }
  const commonBadges = rawPresentations[0]?.badges.filter(
    (badge) => commonBadgeIds.has(badgeIdentity(badge)),
  ) ?? [];
  const multiplicities = decisions.map(scoringMultiplicitiesFromDecision);
  const differingScoringValues = Array.from({ length: 7 }, (_, value) => value)
    .filter((value) =>
      new Set(multiplicities.map((values) => values[value])).size > 1
    );
  const structuralTitles = new Set(
    rawPresentations.map((presentation) => presentation.title),
  );
  const options = rawPresentations.map((presentation, index) => {
    const distinctBadges = presentation.badges.filter(
      (badge) =>
        !commonBadgeIds.has(badgeIdentity(badge)) &&
        !(badge.kind === "scoring" && differingScoringValues.includes(badge.value)),
    );
    let scoringDifferences = differingScoringValues
      .filter((value) => !distinctBadges.some(
        (badge) => badge.kind === "scoring-off" && badge.value === value,
      ))
      .map((value) => ({
        kind: "scoring-preview",
        text: `Σ ${value} ×${multiplicities[index][value]}`,
        value,
        multiplicity: multiplicities[index][value],
      }));
    if (criticalDoubleChoice) {
      const doubleValue =
        crossDecision.effects?.ramifierScoringChange?.value ?? null;
      scoringDifferences = scoringDifferences.filter(
        (difference) => difference.value !== doubleValue,
      );
    }
    let title = structuralTitles.size === 1 && scoringDifferences.length > 0
      ? scoringDifferences[0].text
      : presentation.title;
    let structuralTitle = title === presentation.title
      ? null
      : presentation.title;
    let badges = [...scoringDifferences, ...distinctBadges];
    let transformation = null;
    if (criticalDoubleChoice) {
      if (decisions[index].decisionKind === "continue") {
        title = "Mantener doble";
        structuralTitle = "Otra punta";
        badges = badges.filter(
          (badge) => !["scoring-off", "playable"].includes(badge.kind),
        );
        badges.unshift({
          kind: "scoring-keep",
          text: `Sigue sumando ×${doubleScoringBefore}`,
        });
        transformation = {
          kind: "keep-double",
          before: doubleScoringBefore,
          after: doubleScoringBefore,
          unlocked: 0,
        };
      } else if (decisions[index].decisionKind === "complete-cross") {
        title = "Abrir el doble";
        structuralTitle = "Doble central";
        badges = badges.filter(
          (badge) => !["scoring-off", "playable"].includes(badge.kind),
        );
        badges.unshift(
          { kind: "scoring-off", text: "Deja de sumar" },
          {
            kind: "playable",
            text: `Abre ${crossDecision.effects?.unlockedLateralCount ?? 2} ramas`,
          },
        );
        transformation = {
          kind: "open-double",
          before: doubleScoringBefore,
          after: 0,
          unlocked: crossDecision.effects?.unlockedLateralCount ?? 2,
        };
      }
    }
    const preview = {
      scoringMultiplicities: multiplicities[index],
      branchingDouble: decisions[index].outcome?.branchingDouble ?? null,
    };
    return {
      ...presentation,
      title,
      structuralTitle,
      badges,
      transformation,
      preview,
      visibleSignature: JSON.stringify({
        icon: presentation.icon,
        title,
        structuralTitle,
        badges: badges.map(({ kind, text }) => ({ kind, text })),
        transformation,
      }),
    };
  });
  const signatures = new Set();
  for (const presentation of options) {
    if (signatures.has(presentation.visibleSignature)) {
      throw new Error(
        "Dos decisiones estratégicas distintas resultaron visualmente indistinguibles.",
      );
    }
    signatures.add(presentation.visibleSignature);
  }
  return { commonBadges, options };
}

function renderDecisionTransformation(transformation) {
  if (!transformation) return "";
  const afterClass = transformation.after === 0 ? " is-off" : "";
  const branches = transformation.unlocked > 0
    ? `<span class="port-target-choice__branches" aria-hidden="true"><i></i><b>+${transformation.unlocked}</b><i></i></span>`
    : "";
  return `
    <span class="port-target-choice__transformation is-${transformation.kind}" aria-hidden="true">
      <span class="port-target-choice__score-orbit">×${transformation.before}</span>
      <span class="port-target-choice__transform-arrow">→</span>
      <span class="port-target-choice__score-orbit${afterClass}">×${transformation.after}</span>
      ${branches}
    </span>`;
}

function renderK7Background(scene) {
  const edges = scene.k7Edges.map((edge) => `
    <line class="port-k7__edge" x1="${edge.first.x}" y1="${edge.first.y}" x2="${edge.second.x}" y2="${edge.second.y}"></line>`).join("");
  const loops = scene.nodes.map((node) => `
    <circle class="port-k7__loop" cx="${node.x}" cy="${node.y}" r="72"></circle>`).join("");
  return `<g class="port-k7" aria-hidden="true">${edges}${loops}</g>`;
}

export function renderPortTargetChooserMarkup(
  targetChoice,
  { previewIndex = null } = {},
) {
  if (!targetChoice || targetChoice.decisions.length < 2) {
    return "";
  }
  const choicePresentation = createPortDecisionChoicePresentation(
    targetChoice.decisions,
  );
  const commonMarkup = choicePresentation.commonBadges.length === 0
    ? ""
    : `<div class="port-target-choice__common" aria-label="Consecuencias comunes">${choicePresentation.commonBadges.map((badge) =>
        `<small class="port-target-choice__effect is-${badge.kind}">${escapeAttribute(badge.text)}</small>`
      ).join("")}</div>`;
  const options = targetChoice.decisions.map((decision, index) => {
    const presentation = choicePresentation.options[index];
    const isPreviewed = previewIndex === index;
    const badges = presentation.badges.map((badge) =>
      `<small class="port-target-choice__effect is-${badge.kind}">${escapeAttribute(badge.text)}</small>`
    ).join("");
    const accessibleEffects = presentation.badges.length > 0
      ? `; ${presentation.badges.map((badge) => badge.text).join("; ")}`
      : "";
    return `
    <button type="button" class="port-target-choice__option${isPreviewed ? " is-previewed" : ""}" data-port-choice-index="${index}" aria-pressed="${isPreviewed}" aria-label="${escapeAttribute(presentation.title + accessibleEffects + (isPreviewed ? "; tocar otra vez para jugar" : "; previsualizar"))}">
      <span class="port-target-choice__icon" aria-hidden="true">${presentation.icon}</span>
      <span class="port-target-choice__title">${presentation.title}</span>
      ${presentation.structuralTitle ? `<span class="port-target-choice__structure">${presentation.structuralTitle}</span>` : ""}
      ${renderDecisionTransformation(presentation.transformation)}
      <span class="port-target-choice__effects">${badges}</span>
      ${isPreviewed ? '<span class="port-target-choice__confirm">Toca otra vez para jugar</span>' : ""}
    </button>`;
  }).join("");
  return `
    <section class="port-target-choice" aria-label="Elegir decisión para el valor ${targetChoice.value}">
      <div>
        <span class="port-target-choice__eyebrow">Decisiones · valor</span>
        <strong>${targetChoice.value}</strong>
      </div>
      <div class="port-target-choice__decision-area">${commonMarkup}<div class="port-target-choice__options">${options}</div></div>
      <button type="button" class="port-target-choice__cancel" data-close-port-choice aria-label="Cancelar elección">×</button>
    </section>`;
}

export function renderPortSemanticLegendMarkup(scene) {
  if (scene.showStructure || scene.nodeFocus) return "";
  const introClass = scene.playedPlacementCount <= 4 ? " is-intro" : " is-subtle";
  return `
    <aside class="port-semantic-legend${introClass}" aria-label="Leyenda de Puertos">
      <span class="is-playable"><b aria-hidden="true">↗</b> jugar</span>
      <span class="is-scoring"><b aria-hidden="true">×</b> suma</span>
      <span class="is-history"><b aria-hidden="true">▣</b> salieron</span>
    </aside>`;
}

export function getPortValueAction(scene, value) {
  const decisions = scene.strategicDecisions.filter(
    (decision) => decision.value === value,
  );
  if (decisions.length === 1) {
    return { type: "PLAY", target: decisions[0].canonicalTarget };
  }
  if (decisions.length > 1) {
    return { type: "CHOOSE", value, decisions };
  }
  const targets = scene.openTargets.filter(
    (target) => target.value === value && target.isLegal,
  );
  if (targets.length === 1) {
    return { type: "PLAY", target: targets[0] };
  }
  if (targets.length > 1) {
    return { type: "CHOOSE", value, targets };
  }
  return { type: "NONE", value, targets: [] };
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
      : [];
  const showIncidences = fullStructure || routeOnly;
  const showOpenTargetDetails = fullStructure || routeOnly || focusActive;
  return `
    <svg class="port-graph is-${scene.visualState}${scene.scoringResolution ? " is-scoring-feedback" : ""}" viewBox="${scene.viewBox}" role="group" aria-labelledby="port-title port-description" preserveAspectRatio="xMidYMid meet">
      <title id="port-title">Vista Puertos</title>
      <desc id="port-description">Siete valores fijos. Cada medallón separa lugares para jugar, aportes a la suma y fichas que ya salieron. La estructura completa está disponible bajo demanda.</desc>
      <g class="port-scene-base">
        <ellipse class="port-orbit" cx="${scene.orbit.cx}" cy="${scene.orbit.cy}" rx="${scene.orbit.rx}" ry="${scene.orbit.ry}"></ellipse>
        ${renderK7Background(scene)}
        <g class="port-threads">${renderedThreads.map(renderThread).join("")}</g>
        ${renderCover(scene)}
        <g class="port-route-threads">${routeThreads.map(renderThread).join("")}</g>
        <g class="port-node-shells">${scene.nodes.map(renderNodeShell).join("")}</g>
        <g class="port-bridges">${renderedBridges.map(renderBridge).join("")}</g>
        <g class="port-nodes">${scene.nodes.map((node) => renderNode(node, node.value === scene.expandedNodeValue, scene.hubs.some((hub) => hub.value === node.value), { showIncidences })).join("")}</g>
        <g class="port-double-hubs">${renderedHubs.map(renderHub).join("")}</g>
        <g class="port-open-targets">${focusActive || !showOpenTargetDetails ? "" : scene.openTargets.map((target) => renderOpenTarget(target, scene.hasSelection)).join("")}</g>
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
    this.strategicNodeValue = null;
    this.inspectedRouteId = null;
    this.structureVisible = false;
    this.targetChoiceValue = null;
    this.previewDecisionIndex = null;
    this.lastSelectedDominoId = null;
    this.lastBoardSignature = null;
    this.hasShownRamifierHint = false;
  }

  render(presentation, options = {}) {
    const currentSignature = boardSignature(presentation.portView);
    if (
      this.lastBoardSignature !== null &&
      currentSignature !== this.lastBoardSignature
    ) {
      this.expandedNodeValue = null;
      this.strategicNodeValue = null;
      this.inspectedRouteId = null;
      this.structureVisible = false;
      this.targetChoiceValue = null;
      this.previewDecisionIndex = null;
    }
    this.lastBoardSignature = currentSignature;
    if (this.lastSelectedDominoId !== presentation.selectedDominoId) {
      this.targetChoiceValue = null;
      this.previewDecisionIndex = null;
      this.strategicNodeValue = null;
    }
    this.lastSelectedDominoId = presentation.selectedDominoId;

    const previewDecision = this.targetChoiceValue === null ||
        this.previewDecisionIndex === null
      ? null
      : (presentation.strategicDecisionGroups ?? [])
        .filter((decision) => decision.value === this.targetChoiceValue)[
          this.previewDecisionIndex
        ] ?? null;
    const scene = createPortScene(presentation.portView, {
      selectedDominoId: presentation.selectedDominoId,
      legalTargets: presentation.selectedLegalTargets,
      strategicDecisions: presentation.strategicDecisionGroups ?? [],
      inspectedStructureId: presentation.inspectedStructureId,
      inspectedPlacementId: presentation.inspectedPlacementId,
      inspectedRouteId: this.inspectedRouteId,
      expandedNodeValue: this.expandedNodeValue,
      strategicNodeValue: this.strategicNodeValue,
      selectedTargetValue: this.targetChoiceValue,
      previewDecision,
      showStructure: this.structureVisible,
      layout: this.container.clientWidth >= 760
        ? PORT_SCENE_LAYOUTS.WIDE
        : PORT_SCENE_LAYOUTS.COMPACT,
      scoringResolution: presentation.scoringResolution ?? null,
    });
    const startMarkup = scene.canStart
      ? `<div class="start-action"><button type="button" class="primary-action" data-start-action>Jugar</button></div>`
      : "";
    const showRamifierHint = !this.hasShownRamifierHint &&
      scene.targetChoice === null &&
      scene.nodes.some((node) =>
        node.ramifier !== null && !node.ramifier.lateralPortsUnlocked
      );
    const ramifierHint = showRamifierHint
      ? `<p class="port-ramifier-hint" role="status">Completa el cruce antes de abrir brazos.</p>`
      : "";
    if (showRamifierHint) this.hasShownRamifierHint = true;
    this.container.classList.toggle(
      "has-port-target-choice",
      (scene.targetChoice?.decisions.length ?? 0) > 1,
    );
    this.container.innerHTML = `${renderPortSvgMarkup(scene)}${renderPortStructureToggleMarkup(scene)}${renderPortSemanticLegendMarkup(scene)}${startMarkup}${ramifierHint}${renderPortTargetChooserMarkup(scene.targetChoice, { previewIndex: this.previewDecisionIndex })}${renderPortStrategicInspectorMarkup(scene.strategicInspector)}${renderPortNodeInspectorMarkup(scene.nodeInspector)}`;

    const targetById = new Map(scene.openTargets.map((target) => [target.id, target]));
    const activateNode = (value) => {
      const valueAction = getPortValueAction(scene, value);
      if (!this.structureVisible && presentation.selectedDominoId !== null) {
        if (valueAction.type === "PLAY") {
          options.onTarget?.(valueAction.target);
          return;
        }
        if (valueAction.type === "CHOOSE") {
          this.targetChoiceValue = this.targetChoiceValue === value
            ? null
            : value;
          this.previewDecisionIndex = null;
          this.render(presentation, options);
        }
        return;
      }
      if (!this.structureVisible) {
        this.strategicNodeValue = this.strategicNodeValue === value
          ? null
          : value;
        this.render(presentation, options);
        return;
      }
      this.expandedNodeValue = this.expandedNodeValue === value ? null : value;
      this.strategicNodeValue = null;
      this.inspectedRouteId = null;
      this.targetChoiceValue = null;
      this.previewDecisionIndex = null;
      this.render(presentation, options);
    };
    const activateRoute = (routeId) => {
      this.inspectedRouteId = this.inspectedRouteId === routeId ? null : routeId;
      this.expandedNodeValue = null;
      this.strategicNodeValue = null;
      this.structureVisible = false;
      this.targetChoiceValue = null;
      this.previewDecisionIndex = null;
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
      this.strategicNodeValue = null;
      this.inspectedRouteId = null;
      this.targetChoiceValue = null;
      this.previewDecisionIndex = null;
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
    for (const element of this.container.querySelectorAll("[data-port-choice-index]")) {
      element.addEventListener("click", () => {
        const index = Number(element.dataset.portChoiceIndex);
        const decision = scene.targetChoice?.decisions[
          index
        ];
        if (decision?.canonicalTarget && this.previewDecisionIndex === index) {
          options.onTarget?.(decision.canonicalTarget);
          return;
        }
        this.previewDecisionIndex = index;
        this.render(presentation, options);
      });
    }
    this.container.querySelector("[data-close-port-choice]")?.addEventListener(
      "click",
      () => {
        this.targetChoiceValue = null;
        this.previewDecisionIndex = null;
        this.render(presentation, options);
      },
    );
    this.container.querySelector("[data-close-port-strategic]")?.addEventListener(
      "click",
      () => {
        this.strategicNodeValue = null;
        this.render(presentation, options);
      },
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
      ".port-graph, [data-port-node-inspector], [data-port-strategic-inspector]",
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
        if (this.strategicNodeValue !== null) {
          event.preventDefault();
          this.strategicNodeValue = null;
          this.render(presentation, options);
          return;
        }
        if (this.targetChoiceValue !== null) {
          event.preventDefault();
          this.targetChoiceValue = null;
          this.previewDecisionIndex = null;
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
