function teamName(view, teamId) {
  return view.participants.teams.find((team) => team.teamId === teamId)
    ?.displayName ?? teamId;
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
  if (scoring) {
    messages.push(
      scoring.scoreAwarded > 0
        ? `+${scoring.scoreAwarded} puntos para ${teamName(view, latest.teamId)}`
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
    const expression = document.createElement("span");
    expression.className = "scoring-feedback__expression";
    expression.textContent =
      `${feedback.scoring.expression} = ${feedback.scoring.sum}`;
    const sum = document.createElement("strong");
    sum.className = "scoring-feedback__sum";
    sum.textContent = `S = ${feedback.scoring.sum}`;
    const divisibility = document.createElement("span");
    divisibility.className = "scoring-feedback__divisibility";
    divisibility.textContent = feedback.scoring.isDivisible
      ? `${feedback.scoring.sum} = ${feedback.scoring.divisor} × ${feedback.scoring.quotient}`
      : `${feedback.scoring.sum} no es múltiplo de ${feedback.scoring.divisor}`;
    const outcome = document.createElement("strong");
    outcome.className = feedback.scoring.scoreAwarded > 0
      ? "scoring-feedback__outcome is-award"
      : "scoring-feedback__outcome is-no-award";
    outcome.textContent = feedback.scoring.scoreAwarded > 0
      ? `+${feedback.scoring.scoreAwarded} puntos`
      : "Sin puntos";
    sequence.append(expression, sum, divisibility, outcome);
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
