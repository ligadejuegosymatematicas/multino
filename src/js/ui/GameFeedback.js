function teamName(view, teamId) {
  return view.participants.teams.find((team) => team.teamId === teamId)
    ?.displayName ?? teamId;
}

export const SCORING_FEEDBACK_TIMING = Object.freeze({
  sourcesMs: 1400,
  tokenEmergenceMs: 600,
  tokenTravelMs: 1000,
  expressionMs: 1400,
  sumMs: 1300,
  divisionMs: 1500,
  conclusionMs: 1200,
  totalMs: 9000,
  reducedMotionMs: 1700,
});

const TOKEN_SEQUENCE_START_MS = SCORING_FEEDBACK_TIMING.sourcesMs;
const TOKEN_SEQUENCE_DURATION_MS =
  SCORING_FEEDBACK_TIMING.tokenEmergenceMs +
  SCORING_FEEDBACK_TIMING.tokenTravelMs;
const TOKEN_STAGGER_MS = 160;

function sourceMultiplicities(terms) {
  const result = Array.from({ length: 7 }, () => 0);
  for (const term of terms) {
    result[term.value] += term.factor;
  }
  return result;
}

export function createScoringSourceTokens(terms) {
  const nextIndexByValue = Array.from({ length: 7 }, () => 0);
  const tokens = [];
  for (const term of terms) {
    for (let factorIndex = 0; factorIndex < term.factor; factorIndex += 1) {
      const valueIndex = nextIndexByValue[term.value];
      nextIndexByValue[term.value] += 1;
      tokens.push({
        id: `score-token:${tokens.length + 1}`,
        anchorId: term.isDouble
          ? `double:${term.placementId}:${factorIndex}`
          : `port:${term.placementId}:${term.portId}`,
        order: tokens.length,
        value: term.value,
        valueIndex,
        placementId: term.placementId,
        portId: term.portId,
        isDouble: term.isDouble,
        factorIndex,
      });
    }
  }
  return tokens;
}

export function createScoringFeedbackPresentation(scoring, scoringTeamName) {
  if (!scoring) {
    return null;
  }
  const divisionQuotient = Number.isSafeInteger(scoring.divisionQuotient)
    ? scoring.divisionQuotient
    : Math.floor(scoring.sum / scoring.divisor);
  const remainder = Number.isSafeInteger(scoring.remainder)
    ? scoring.remainder
    : scoring.sum % scoring.divisor;
  const isZero = scoring.sum === 0;
  const terms = scoring.terms.filter(
      (term) => term.isDouble !== true || term.factor > 0,
    );
  const sourceTokens = createScoringSourceTokens(terms);
  return {
    terms,
    sourceTokens,
    sourceMultiplicities: sourceMultiplicities(terms),
    expression: scoring.expression,
    sum: scoring.sum,
    divisor: scoring.divisor,
    divisionQuotient,
    remainder,
    isDivisible: scoring.isDivisible,
    scoreAwarded: scoring.scoreAwarded,
    scoringTeamName,
    divisionText: isZero
      ? "0 puntos"
      : scoring.isDivisible
        ? `${scoring.sum} = ${scoring.divisor} × ${scoring.quotient}`
        : `${scoring.sum} = ${scoring.divisor} × ${divisionQuotient} + ${remainder}`,
    outcomeText: isZero
      ? "0 puntos"
      : scoring.scoreAwarded > 0
        ? `+${scoring.scoreAwarded} ${scoringTeamName}`
        : "0 puntos",
    verdictText: isZero
      ? ""
      : scoring.scoreAwarded > 0
        ? `¡Múltiplo de ${scoring.divisor}!`
        : `Σ no es múltiplo de ${scoring.divisor}`,
    outcomeKind: isZero
      ? "zero"
      : scoring.scoreAwarded > 0
        ? "award"
        : "no-award",
    stages: Object.freeze([
      "sources",
      "tokens",
      "expression",
      "sum",
      "division",
      "conclusion",
      "outcome",
    ]),
  };
}

/** Feedback efímero derivado de una acción ya aceptada; no decide reglas. */
export function getGameFeedback(view) {
  const latest = view.latestAction;
  if (!latest) {
    return null;
  }

  const messages = [];
  const scoring = latest.type === "PLAY_DOMINO"
    ? view.scoringPresentation?.latestResolution ?? null
    : null;
  const scoringTeamName = teamName(view, latest.teamId);
  const scoringFeedback = createScoringFeedbackPresentation(
    scoring,
    scoringTeamName,
  );
  if (scoring) {
    messages.push(
      scoring.scoreAwarded > 0
        ? `+${scoring.scoreAwarded} puntos para ${scoringTeamName}`
        : "Sin puntos",
    );
  }

  let openedBranchFamily = null;
  if (latest.type === "PLAY_DOMINO") {
    const placement = view.topology.placements.find(
      (candidate) => candidate.placementId === latest.placementId,
    );
    if (placement?.region === "branch" && placement.depth === 1) {
      openedBranchFamily = "Nueva rama";
      messages.push("Nueva rama abierta");
    }
  }

  return {
    sequence: latest.sequence,
    playerId: latest.playerId,
    teamId: latest.teamId,
    scoreAwarded: latest.type === "PLAY_DOMINO"
      ? latest.scoreAwarded ?? 0
      : 0,
    scoring,
    scoringFeedback,
    scoringTeamName,
    openedBranchFamily,
    message: messages.join(" · "),
    endedRound: latest.endedRound,
  };
}

function renderDivision(model) {
  const wrapper = document.createElement("span");
  wrapper.className = "scoring-feedback__divisibility";
  if (model.sum === 0) {
    wrapper.textContent = "Σ = 0";
    return wrapper;
  }
  wrapper.append(`${model.sum} = ${model.divisor} × `);
  const quotient = document.createElement("strong");
  quotient.className = `scoring-feedback__quotient ${
    model.isDivisible ? "is-score" : "is-context"
  }`;
  quotient.textContent = String(
    model.isDivisible ? model.scoreAwarded : model.divisionQuotient,
  );
  wrapper.append(quotient);
  if (!model.isDivisible) {
    wrapper.append(" + ");
    const remainder = document.createElement("strong");
    remainder.className = "scoring-feedback__remainder is-focus";
    remainder.textContent = String(model.remainder);
    wrapper.append(remainder);
    const remainderLabel = document.createElement("span");
    remainderLabel.className = "scoring-feedback__remainder-label";
    remainderLabel.textContent = `resto = ${model.remainder}`;
    wrapper.append(remainderLabel);
  }
  return wrapper;
}

function rectCenter(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/** Both rectangles use viewport coordinates from getBoundingClientRect(). */
export function calculateScoringTokenTravel(sourceRect, slotRect) {
  const source = rectCenter(sourceRect);
  const destination = rectCenter(slotRect);
  return {
    source,
    destination,
    deltaX: source.x - destination.x,
    deltaY: source.y - destination.y,
  };
}

export function createScoringTokenMotion(travel) {
  const distance = Math.hypot(travel.deltaX, travel.deltaY);
  const arc = Math.min(52, Math.max(18, distance * 0.09));
  const midpointDelta = {
    x: travel.deltaX * 0.48,
    y: travel.deltaY * 0.48 - arc,
  };
  return {
    start: travel.source,
    midpoint: {
      x: travel.destination.x + midpointDelta.x,
      y: travel.destination.y + midpointDelta.y,
    },
    end: travel.destination,
    keyframes: [
      {
        opacity: 0,
        transform: `translate(${travel.deltaX}px, ${travel.deltaY}px) scale(.72)`,
        offset: 0,
      },
      {
        opacity: 1,
        transform: `translate(${travel.deltaX}px, ${travel.deltaY}px) scale(1)`,
        offset: 0.1,
      },
      {
        opacity: 1,
        transform: `translate(${travel.deltaX}px, ${travel.deltaY}px) scale(1)`,
        offset: 0.42,
      },
      {
        opacity: 1,
        transform: `translate(${midpointDelta.x}px, ${midpointDelta.y}px) scale(1.08)`,
        offset: 0.7,
      },
      { opacity: 1, transform: "translate(0, 0) scale(1)", offset: 1 },
    ],
  };
}

function setTokenAtSource(tokenElement, travel) {
  tokenElement.style.setProperty("--token-source-dx", `${travel.deltaX}px`);
  tokenElement.style.setProperty("--token-source-dy", `${travel.deltaY}px`);
}

/**
 * FLIP en un único espacio de coordenadas: ambos rectángulos proceden de
 * getBoundingClientRect() y, por tanto, ya incluyen cámara, zoom y scroll.
 * El nodo que se mueve es el mismo que queda dentro del slot de Σ.
 */
function animateTokenIntoSlot(tokenElement, travel, order) {
  setTokenAtSource(tokenElement, travel);
  tokenElement.dataset.scoringTokenState = "source";
  tokenElement.classList.add("is-source-connected");
  if (typeof tokenElement.animate !== "function") return;

  tokenElement.getAnimations?.().forEach((animation) => animation.cancel());
  const delay = TOKEN_SEQUENCE_START_MS +
    Math.min(order * TOKEN_STAGGER_MS, 720);
  const motion = createScoringTokenMotion(travel);
  tokenElement.dataset.scoringTokenStartX = String(motion.start.x);
  tokenElement.dataset.scoringTokenStartY = String(motion.start.y);
  tokenElement.dataset.scoringTokenMidX = String(motion.midpoint.x);
  tokenElement.dataset.scoringTokenMidY = String(motion.midpoint.y);
  tokenElement.dataset.scoringTokenEndX = String(motion.end.x);
  tokenElement.dataset.scoringTokenEndY = String(motion.end.y);
  const animation = tokenElement.animate(
    motion.keyframes,
    {
      duration: TOKEN_SEQUENCE_DURATION_MS,
      delay,
      easing: "cubic-bezier(.22,.72,.2,1)",
      fill: "both",
    },
  );
  animation.addEventListener("finish", () => {
    tokenElement.dataset.scoringTokenState = "slot";
  }, { once: true });
}

function connectScoringTokensToSources(model, termElements) {
  if (typeof document === "undefined") return;
  if (
    model.sourceTokens.length === 0 ||
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  ) return;
  const anchorsByValue = new Map();
  const anchorsById = new Map();
  for (const anchor of document.querySelectorAll(
    "[data-scoring-anchor-value]",
  )) {
    const value = Number(anchor.dataset.scoringAnchorValue);
    const anchors = anchorsByValue.get(value) ?? [];
    anchors.push(anchor);
    anchorsByValue.set(value, anchors);
    if (anchor.dataset.scoringAnchorId) {
      anchorsById.set(anchor.dataset.scoringAnchorId, anchor);
    }
  }
  model.sourceTokens.forEach((token, index) => {
    const anchors = anchorsByValue.get(token.value) ?? [];
    const anchor = anchorsById.get(token.anchorId) ??
      anchors[token.valueIndex] ?? anchors.at(-1);
    const destination = termElements[index];
    if (!anchor || !destination) return;
    const sourceRect = anchor.getBoundingClientRect();
    const destinationRect = destination.getBoundingClientRect();
    const travel = calculateScoringTokenTravel(sourceRect, destinationRect);
    destination.dataset.scoringSourceAnchor = token.anchorId;
    destination.style.setProperty("--token-order", String(token.order));
    animateTokenIntoSlot(destination, travel, token.order);
  });
}

function connectAwardToScore(outcome) {
  const target = document.querySelector(
    ".score-team.is-score-feedback strong",
  );
  if (!target) return;
  const sourceRect = outcome.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  outcome.classList.add("has-score-target");
  outcome.style.setProperty(
    "--score-transfer-x",
    `${targetRect.left + targetRect.width / 2 -
      (sourceRect.left + sourceRect.width / 2)}px`,
  );
  outcome.style.setProperty(
    "--score-transfer-y",
    `${targetRect.top + targetRect.height / 2 -
      (sourceRect.top + sourceRect.height / 2)}px`,
  );
}

export function renderGameFeedback(container, feedback) {
  if (!container) {
    return;
  }
  container.hidden = !feedback?.message;
  container.replaceChildren();
  container.removeAttribute("aria-label");
  container.removeAttribute("role");
  container.removeAttribute("tabindex");
  container.onclick = null;
  container.onkeydown = null;
  container.classList.remove(
    "is-score-feedback",
    "is-branch-feedback",
    "is-complete",
  );
  if (!feedback?.message) {
    return;
  }
  if (feedback.scoring) {
    const sequence = document.createElement("span");
    sequence.className = "scoring-feedback";
    const model = feedback.scoringFeedback ??
      createScoringFeedbackPresentation(
        feedback.scoring,
        feedback.scoringTeamName ?? "",
      );
    const source = document.createElement("span");
    source.className = "scoring-feedback__source";
    source.textContent = "Puntas que suman";
    const terms = document.createElement("span");
    terms.className = "scoring-feedback__terms";
    terms.dataset.scoringExpression = "slots";
    const sigma = document.createElement("strong");
    sigma.className = "scoring-feedback__sigma";
    sigma.textContent = "Σ =";
    terms.append(sigma);
    const tokenElements = [];
    for (const [index, token] of model.sourceTokens.entries()) {
      const slot = document.createElement("span");
      slot.className = "scoring-feedback__slot";
      slot.dataset.scoringSlotId = token.id;
      slot.setAttribute("aria-hidden", "true");
      const chip = document.createElement("span");
      chip.className = "scoring-feedback__term";
      chip.style.setProperty("--term-index", String(index));
      chip.dataset.scoringTokenId = token.id;
      chip.dataset.scoringTokenState = "pending";
      chip.textContent = String(token.value);
      slot.append(chip);
      terms.append(slot);
      tokenElements.push(chip);
      if (index < model.sourceTokens.length - 1) {
        const plus = document.createElement("span");
        plus.className = "scoring-feedback__operator";
        plus.textContent = "+";
        terms.append(plus);
      }
    }
    if (model.sourceTokens.length === 0) {
      const zero = document.createElement("span");
      zero.className = "scoring-feedback__term is-empty";
      zero.textContent = "0";
      terms.append(zero);
    }
    const sum = document.createElement("span");
    sum.className = "scoring-feedback__sum";
    const equals = document.createElement("span");
    equals.className = "scoring-feedback__equals";
    equals.textContent = "Σ =";
    const result = document.createElement("strong");
    result.className = "scoring-feedback__result";
    result.textContent = String(model.sum);
    sum.append(equals, result);
    const divisibility = renderDivision(model);
    const verdict = document.createElement("span");
    verdict.className = `scoring-feedback__verdict is-${model.outcomeKind}`;
    verdict.textContent = model.verdictText;
    verdict.hidden = model.verdictText === "";
    const outcome = document.createElement("strong");
    outcome.className = `scoring-feedback__outcome is-${model.outcomeKind}`;
    outcome.textContent = model.outcomeText;
    if (feedback.showScoringLesson) {
      const lesson = document.createElement("span");
      lesson.className = "scoring-feedback__lesson";
      lesson.textContent =
        `Suma las puntas. Si Σ es múltiplo de ${model.divisor}, ganas Σ÷${model.divisor} puntos.`;
      sequence.append(lesson);
    }
    sequence.append(source, terms, sum, divisibility, verdict, outcome);
    container.append(sequence);
    connectScoringTokensToSources(model, tokenElements);
    if (model.outcomeKind === "award") connectAwardToScore(outcome);
    container.setAttribute(
      "aria-label",
      feedback.message,
    );
  }
  if (feedback.openedBranchFamily) {
    const branch = document.createElement("span");
    branch.className = "branch-feedback";
    branch.textContent = `${feedback.openedBranchFamily} abierta`;
    container.append(branch);
  }
  if (!feedback.scoring) {
    container.setAttribute("aria-label", feedback.message);
  }
  container.classList.toggle("is-score-feedback", feedback.scoring != null);
  container.classList.toggle(
    "is-branch-feedback",
    feedback.openedBranchFamily != null,
  );
}
