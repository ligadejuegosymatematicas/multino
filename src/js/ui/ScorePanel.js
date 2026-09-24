function teamName(view, teamId) {
  return view.participants.teams.find((team) => team.teamId === teamId)
    ?.displayName ?? teamId;
}

export function getDisplayedTeamScore(team, feedback = null) {
  const pendingAward = feedback?.teamId === team.teamId &&
    feedback.scoreAwarded > 0
    ? feedback.scoreAwarded
    : 0;
  return team.score - pendingAward;
}

export function getScorePanelSumPresentation(view, { feedback = null } = {}) {
  const scoring = view.scoringPresentation;
  if (!scoring.enabled) return null;
  return feedback?.scoring
    ? { text: "Σ = …", isPending: true }
    : { text: `Σ = ${scoring.sum}`, isPending: false };
}

export function renderScorePanel(
  container,
  view,
  { feedback = null, showCurrentSum = false } = {},
) {
  if (!container) {
    return;
  }
  container.replaceChildren();
  for (const team of view.participants.teams) {
    const item = document.createElement("div");
    item.className = "score-team";
    const hasAward = feedback?.teamId === team.teamId &&
      feedback.scoreAwarded > 0;
    item.classList.toggle("is-score-feedback", hasAward);
    item.dataset.teamId = team.teamId;
    const name = document.createElement("span");
    name.className = "score-team__identity";
    const badge = document.createElement("span");
    badge.className = "team-badge";
    badge.dataset.teamId = team.teamId;
    badge.textContent = team.teamId;
    badge.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = team.displayName;
    name.append(badge, label);
    const score = document.createElement("strong");
    const displayedScore = getDisplayedTeamScore(team, feedback);
    score.textContent = String(displayedScore);
    score.setAttribute("aria-label", `${displayedScore} puntos`);
    item.append(name, score);
    if (hasAward) {
      const delta = document.createElement("span");
      delta.className = "score-team__delta";
      delta.textContent = `+${feedback.scoreAwarded}`;
      item.append(delta);
    }
    container.append(item);
  }
  const sumPresentation = showCurrentSum
    ? getScorePanelSumPresentation(view, { feedback })
    : null;
  container.classList.toggle("has-current-sum", sumPresentation !== null);
  if (sumPresentation) {
    const sum = document.createElement("strong");
    sum.className = "score-current-sum";
    sum.classList.toggle("is-pending", sumPresentation.isPending);
    sum.textContent = sumPresentation.text;
    sum.setAttribute(
      "aria-label",
      sumPresentation.isPending
        ? "Calculando la suma de las puntas"
        : `Suma actual de las puntas: ${view.scoringPresentation.sum}`,
    );
    container.append(sum);
  }
}

export function getScoringPanelPresentation(view, { feedback = null } = {}) {
  const scoring = view.scoringPresentation;
  if (!scoring.enabled) return null;
  return feedback?.scoring
    ? { sumText: "Σ = …", expression: null, isPending: true }
    : {
        sumText: `Σ = ${scoring.sum}`,
        expression: scoring.expression,
        isPending: false,
      };
}

export function shouldDeferRoundResult({
  isFinished,
  feedback = null,
  revealRoundResult = true,
}) {
  return Boolean(
    isFinished && (!revealRoundResult || feedback?.scoring),
  );
}

export function renderScoringPanel(container, view, { feedback = null } = {}) {
  if (!container) {
    return;
  }
  const presentation = getScoringPanelPresentation(view, { feedback });
  container.hidden = presentation === null;
  container.innerHTML = "";
  if (!presentation) {
    return;
  }
  container.classList.toggle("is-pending", presentation.isPending);
  const sum = document.createElement("strong");
  sum.className = "scoring-sum";
  sum.textContent = presentation.sumText;
  container.append(sum);
  if (presentation.expression === null) return;
  const details = document.createElement("details");
  details.className = "scoring-detail";
  const summary = document.createElement("summary");
  summary.textContent = "Ver suma";
  const expression = document.createElement("span");
  expression.textContent = presentation.expression;
  details.append(summary, expression);
  container.append(details);
}

export function getRoundResultPresentation(view) {
  const result = view.roundStatus.roundResult;
  if (!result) {
    return null;
  }
  const teams = view.participants.teams.map((team) => ({
    teamId: team.teamId,
    displayName: team.displayName,
    score: team.score,
  }));
  const winner = result.winnerTeamId === null
    ? null
    : teams.find((team) => team.teamId === result.winnerTeamId);
  return {
    headline: result.isTie
      ? "EMPATE FINAL"
      : `${winner.displayName.toLocaleUpperCase("es")} GANA`,
    scoreLine: teams.map((team) => team.score).join(" – "),
    scoreTeams: teams.map((team) => team.displayName).join(" – "),
    reason: result.reason === "EMPTY_HAND"
      ? "Final por salida"
      : "Final por tranque",
    traditionalWinner: result.traditionalWinnerTeamId
      ? teamName(view, result.traditionalWinnerTeamId)
      : "ninguno",
    traditionalWinnerTeamId: result.traditionalWinnerTeamId,
    finalBonus: result.finalBonus,
    isTie: result.isTie,
    winnerTeamId: result.winnerTeamId,
  };
}

export function renderRoundResult(container, view, { deferred = false } = {}) {
  if (!container) {
    return;
  }
  const result = getRoundResultPresentation(view);
  container.hidden = !result || deferred;
  container.replaceChildren();
  if (!result || deferred) {
    return;
  }
  const title = document.createElement("h2");
  title.className = "round-result__headline";
  title.textContent = result.headline;
  const score = document.createElement("strong");
  score.className = "round-result__score";
  score.textContent = result.scoreLine;
  const scoreTeams = document.createElement("span");
  scoreTeams.className = "round-result__teams";
  scoreTeams.textContent = result.scoreTeams;
  const reason = document.createElement("p");
  reason.textContent = result.reason;
  const explanation = document.createElement("div");
  explanation.className = "round-result__explanation";
  explanation.append(reason);
  if (
    result.traditionalWinnerTeamId !== null &&
    result.traditionalWinnerTeamId !== result.winnerTeamId
  ) {
    const traditional = document.createElement("p");
    traditional.textContent =
      `Vencedor antes de la bonificación: ${result.traditionalWinner}`;
    explanation.append(traditional);
  }
  if (result.finalBonus > 0) {
    const bonus = document.createElement("p");
    bonus.textContent = `Bonificación final: +${result.finalBonus}`;
    explanation.append(bonus);
  }
  container.append(title, score, scoreTeams, explanation);
}
