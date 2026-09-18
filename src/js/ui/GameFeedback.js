function teamName(view, teamId) {
  return view.participants.teams.find((team) => team.teamId === teamId)
    ?.displayName ?? teamId;
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
  return {
    terms: scoring.terms.filter(
      (term) => term.isDouble !== true || term.factor > 0,
    ),
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

export function renderGameFeedback(container, feedback) {
  if (!container) {
    return;
  }
  container.hidden = !feedback?.message;
  container.replaceChildren();
  container.removeAttribute("aria-label");
  container.classList.remove("is-score-feedback", "is-branch-feedback");
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
    source.textContent = "Suman las puntas";
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
    const divisibility = document.createElement("span");
    divisibility.className = "scoring-feedback__divisibility";
    divisibility.textContent = model.divisionText;
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
  }
  if (feedback.openedBranchFamily) {
    const branch = document.createElement("span");
    branch.className = "branch-feedback";
    branch.textContent = `${feedback.openedBranchFamily} abierta`;
    container.append(branch);
  }
  container.setAttribute("aria-label", feedback.message);
  container.classList.toggle("is-score-feedback", feedback.scoring != null);
  container.classList.toggle(
    "is-branch-feedback",
    feedback.openedBranchFamily != null,
  );
}
