export function renderTurnPanel(container, view, { emphasize = false } = {}) {
  if (!container) {
    return;
  }
  const current = view.participants.players.find(
    (player) => player.playerId === view.turn.currentPlayerId,
  );
  const team = view.participants.teams.find(
    (candidate) => candidate.teamId === current.teamId,
  );
  container.replaceChildren();
  container.classList.toggle("is-turn-feedback", emphasize);
  const heading = document.createElement("strong");
  heading.textContent = view.roundStatus.phase === "finished"
    ? "Ronda cerrada"
    : `${current.displayName} · ${team.displayName}`;
  container.append(heading);
  if (
    view.roundStatus.phase !== "finished" &&
    view.turn.consecutivePasses > 0
  ) {
    const detail = document.createElement("span");
    detail.textContent = `${view.turn.consecutivePasses} ${view.turn.consecutivePasses === 1 ? "pase" : "pases"} seguidos`;
    container.append(detail);
  }
}

export function renderPlayerCounts(container, view) {
  if (!container) {
    return;
  }
  container.replaceChildren();
  for (const player of view.participants.players) {
    const item = document.createElement("li");
    item.className = player.isCurrentPlayer ? "is-current" : "";
    item.textContent = player.isCurrentPlayer
      ? `Tu mano · ${player.remainingDominoCount}`
      : `${player.displayName} · ${player.remainingDominoCount}`;
    container.append(item);
  }
}
