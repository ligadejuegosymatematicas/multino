function teamName(view, teamId) {
  return view.participants.teams.find((team) => team.teamId === teamId)
    ?.displayName ?? teamId;
}

export function renderScorePanel(container, view) {
  if (!container) {
    return;
  }
  container.replaceChildren();
  for (const team of view.participants.teams) {
    const item = document.createElement("div");
    item.className = "score-team";
    const name = document.createElement("span");
    name.textContent = team.displayName;
    const score = document.createElement("strong");
    score.textContent = String(team.score);
    score.setAttribute("aria-label", `${team.score} puntos`);
    item.append(name, score);
    container.append(item);
  }
}

export function renderScoringPanel(container, view) {
  if (!container) {
    return;
  }
  const expression = view.scoring.contributionGroups.length > 0
    ? view.scoring.contributionGroups
        .map((group) =>
          group.count === 1
            ? String(group.contribution)
            : `${group.contribution}×${group.count}`,
        )
        .join(" + ")
    : "sin términos";
  const latest = view.latestAction;
  const awarded = latest?.type === "PLAY_DOMINO" &&
      Number.isSafeInteger(latest.scoreAwarded)
    ? latest.scoreAwarded
    : null;
  container.innerHTML = "";
  const sum = document.createElement("strong");
  sum.className = "scoring-sum";
  sum.textContent = `S = ${view.scoring.sum}`;
  const detail = document.createElement("span");
  detail.className = "scoring-detail";
  detail.textContent = expression;
  container.append(sum, detail);
  if (awarded !== null) {
    const result = document.createElement("span");
    result.className = awarded > 0 ? "score-award" : "score-no-award";
    result.textContent = awarded > 0
      ? `Última jugada: S = ${latest.openEndsSum}, +${awarded} puntos`
      : `Última jugada: S = ${latest.openEndsSum}, sin puntos`;
    container.append(result);
  }
}

export function renderRoundResult(container, view) {
  if (!container) {
    return;
  }
  const result = view.roundStatus.roundResult;
  container.hidden = !result;
  container.replaceChildren();
  if (!result) {
    return;
  }
  const title = document.createElement("h2");
  title.textContent = "Ronda terminada";
  const reason = document.createElement("p");
  reason.textContent = result.reason === "EMPTY_HAND"
    ? "Final por salida"
    : "Final por tranque";
  const traditional = document.createElement("p");
  traditional.textContent = result.traditionalWinnerTeamId
    ? `Vencedor tradicional: ${teamName(view, result.traditionalWinnerTeamId)}`
    : "Vencedor tradicional: ninguno";
  const bonus = document.createElement("p");
  bonus.textContent = `Bonificación final: ${result.finalBonus}`;
  const winner = document.createElement("strong");
  winner.textContent = result.isTie
    ? "Resultado por puntaje: empate"
    : `Ganador por puntaje: ${teamName(view, result.winnerTeamId)}`;
  container.append(title, reason, traditional, bonus, winner);
}
