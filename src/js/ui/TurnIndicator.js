export function renderTurnPanel(container, view) {
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
  const heading = document.createElement("strong");
  heading.textContent = view.roundStatus.phase === "finished"
    ? "Ronda cerrada"
    : `${current.displayName} · ${team.displayName}`;
  const detail = document.createElement("span");
  detail.textContent = view.roundStatus.phase === "finished"
    ? `La acción ${view.turn.turnNumber} fue la última.`
    : `Acción ${view.turn.turnNumber} · ${view.turn.consecutivePasses} pases consecutivos`;
  container.append(heading, detail);
}

export function renderPlayerCounts(container, view) {
  if (!container) {
    return;
  }
  container.replaceChildren();
  for (const player of view.participants.players) {
    const item = document.createElement("li");
    item.className = player.isCurrentPlayer ? "is-current" : "";
    item.textContent = `${player.displayName}: ${player.remainingDominoCount} fichas`;
    container.append(item);
  }
}
