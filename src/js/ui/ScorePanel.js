function teamName(view, teamId) {
  return view.participants.teams.find((team) => team.teamId === teamId)
    ?.displayName ?? teamId;
}

export function renderScorePanel(container, view, { feedback = null } = {}) {
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
    const name = document.createElement("span");
    name.textContent = team.displayName;
    const score = document.createElement("strong");
    score.textContent = String(team.score);
    score.setAttribute("aria-label", `${team.score} puntos`);
    item.append(name, score);
    if (hasAward) {
      const delta = document.createElement("span");
      delta.className = "score-team__delta";
      delta.textContent = `+${feedback.scoreAwarded}`;
      item.append(delta);
    }
    container.append(item);
  }
}

export function renderScoringPanel(container, view) {
  if (!container) {
    return;
  }
  const scoring = view.scoringPresentation;
  container.hidden = !scoring.enabled;
  container.innerHTML = "";
  if (!scoring.enabled) {
    return;
  }
  const sum = document.createElement("strong");
  sum.className = "scoring-sum";
  sum.textContent = `S = ${scoring.sum}`;
  const details = document.createElement("details");
  details.className = "scoring-detail";
  const summary = document.createElement("summary");
  summary.textContent = "Ver suma";
  const expression = document.createElement("span");
  expression.textContent = scoring.expression;
  details.append(summary, expression);
  container.append(sum, details);
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
    finalBonus: result.finalBonus,
    isTie: result.isTie,
    winnerTeamId: result.winnerTeamId,
  };
}

export function renderRoundResult(container, view) {
  if (!container) {
    return;
  }
  const result = getRoundResultPresentation(view);
  container.hidden = !result;
  container.replaceChildren();
  if (!result) {
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
  const traditional = document.createElement("p");
  traditional.textContent =
    `Vencedor tradicional: ${result.traditionalWinner}`;
  const bonus = document.createElement("p");
  bonus.textContent =
    `Bonificación final: ${result.finalBonus > 0 ? "+" : ""}${result.finalBonus}`;
  const explanation = document.createElement("div");
  explanation.className = "round-result__explanation";
  explanation.append(reason, traditional, bonus);
  container.append(title, score, scoreTeams, explanation);
}
