function teamName(view, teamId) {
  return view.participants.teams.find((team) => team.teamId === teamId)
    ?.displayName ?? teamId;
}

export const SCORING_FEEDBACK_TIMING = Object.freeze({
  sourcesMs: 1150,
  expressionMs: 1050,
  sumMs: 850,
  divisionMs: 950,
  transferMs: 650,
  totalMs: 4650,
  reducedMotionMs: 800,
});

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
        : "No puntúa",
    outcomeKind: isZero
      ? "zero"
      : scoring.scoreAwarded > 0
        ? "award"
        : "no-award",
    stages: Object.freeze([
      "sources",
      "expression",
      "sum",
      "division",
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
      openedBranchFamily = "Nuevo brazo";
      messages.push("Nuevo brazo abierto");
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
    wrapper.textContent = "0 puntos";
    return wrapper;
  }
  wrapper.append(`${model.sum} = ${model.divisor} × `);
  const quotient = document.createElement("strong");
  quotient.className = "scoring-feedback__quotient";
  quotient.textContent = String(
    model.isDivisible ? model.scoreAwarded : model.divisionQuotient,
  );
  wrapper.append(quotient);
  if (!model.isDivisible) {
    wrapper.append(" + ");
    const remainder = document.createElement("strong");
    remainder.className = "scoring-feedback__remainder";
    remainder.textContent = String(model.remainder);
    wrapper.append(remainder);
    const remainderLabel = document.createElement("span");
    remainderLabel.className = "scoring-feedback__remainder-label";
    remainderLabel.textContent = `resto ${model.remainder}`;
    wrapper.append(remainderLabel);
  }
  return wrapper;
}

function clearScoringFlightLayer() {
  if (typeof document === "undefined") return;
  document.querySelector("[data-scoring-flight-layer]")?.remove();
}

function renderScoringFlightTokens(model, termElements) {
  if (typeof document === "undefined") return null;
  clearScoringFlightLayer();
  if (
    model.sourceTokens.length === 0 ||
    globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
  ) return null;
  const layer = document.createElement("span");
  layer.className = "scoring-flight-layer";
  layer.dataset.scoringFlightLayer = "";
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
    const flight = document.createElement("span");
    flight.className = "scoring-flight-token";
    flight.textContent = String(token.value);
    flight.style.setProperty("--token-order", String(token.order));
    flight.style.setProperty(
      "--token-from-x",
      `${sourceRect.left + sourceRect.width / 2}px`,
    );
    flight.style.setProperty(
      "--token-from-y",
      `${sourceRect.top + sourceRect.height / 2}px`,
    );
    flight.style.setProperty(
      "--token-to-x",
      `${destinationRect.left + destinationRect.width / 2}px`,
    );
    flight.style.setProperty(
      "--token-to-y",
      `${destinationRect.top + destinationRect.height / 2}px`,
    );
    layer.append(flight);
  });
  document.body.append(layer);
  return layer;
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

export function renderGameFeedback(container, feedback, { onComplete } = {}) {
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
  clearScoringFlightLayer();
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
    const tokenElements = [];
    for (const [index, token] of model.sourceTokens.entries()) {
      const chip = document.createElement("span");
      chip.className = "scoring-feedback__term";
      chip.style.setProperty("--term-index", String(index));
      chip.dataset.scoringTokenId = token.id;
      chip.textContent = String(token.value);
      terms.append(chip);
      tokenElements.push(chip);
      if (index < model.sourceTokens.length - 1) {
        const plus = document.createElement("span");
        plus.className = "scoring-feedback__operator";
        plus.textContent = "+";
        terms.append(plus);
      }
    }
    if (model.sourceTokens.length === 0) {
      terms.textContent = "0";
    }
    const sum = document.createElement("span");
    sum.className = "scoring-feedback__sum";
    const equals = document.createElement("span");
    equals.className = "scoring-feedback__equals";
    equals.textContent = "=";
    const result = document.createElement("strong");
    result.className = "scoring-feedback__result";
    result.textContent = String(model.sum);
    const sumLabel = document.createElement("strong");
    sumLabel.className = "scoring-feedback__sum-label";
    sumLabel.textContent = `S = ${model.sum}`;
    sum.append(equals, result, sumLabel);
    const divisibility = renderDivision(model);
    const outcome = document.createElement("strong");
    outcome.className = `scoring-feedback__outcome is-${model.outcomeKind}`;
    outcome.textContent = model.outcomeText;
    if (feedback.showScoringLesson) {
      const lesson = document.createElement("span");
      lesson.className = "scoring-feedback__lesson";
      lesson.textContent =
        `Suma las puntas. Si S es múltiplo de ${model.divisor}, anotas S÷${model.divisor}.`;
      sequence.append(lesson);
    }
    sequence.append(source, terms, sum, divisibility, outcome);
    container.append(sequence);
    const flightLayer = renderScoringFlightTokens(model, tokenElements);
    if (model.outcomeKind === "award") connectAwardToScore(outcome);
    container.setAttribute("role", "button");
    container.setAttribute("tabindex", "0");
    container.setAttribute(
      "aria-label",
      `${feedback.message}. Toca para completar la explicación.`,
    );
    const complete = () => {
      container.classList.add("is-complete");
      flightLayer?.remove();
      onComplete?.();
    };
    container.onclick = complete;
    container.onkeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        complete();
      }
    };
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
