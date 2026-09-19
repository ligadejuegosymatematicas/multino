function teamName(view, teamId) {
  return view.participants.teams.find((team) => team.teamId === teamId)
    ?.displayName ?? teamId;
}

export const SCORING_FEEDBACK_TIMING = Object.freeze({
  sourcesMs: 900,
  expressionMs: 800,
  sumMs: 600,
  divisionMs: 650,
  transferMs: 350,
  totalMs: 3300,
  reducedMotionMs: 650,
});

function sourceMultiplicities(terms) {
  const result = Array.from({ length: 7 }, () => 0);
  for (const term of terms) {
    result[term.value] += term.factor;
  }
  return result;
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
  return {
    terms,
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
    for (const [index, term] of model.terms.entries()) {
      const chip = document.createElement("span");
      chip.className = "scoring-feedback__term";
      chip.style.setProperty("--term-index", String(index));
      chip.textContent = term.label;
      terms.append(chip);
      if (index < model.terms.length - 1) {
        const plus = document.createElement("span");
        plus.className = "scoring-feedback__operator";
        plus.textContent = "+";
        terms.append(plus);
      }
    }
    if (model.terms.length === 0) {
      terms.textContent = "0";
    }
    const sum = document.createElement("strong");
    sum.className = "scoring-feedback__sum";
    sum.textContent = `S = ${model.sum}`;
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
    container.setAttribute("role", "button");
    container.setAttribute("tabindex", "0");
    container.setAttribute(
      "aria-label",
      `${feedback.message}. Toca para completar la explicación.`,
    );
    const complete = () => {
      container.classList.add("is-complete");
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
