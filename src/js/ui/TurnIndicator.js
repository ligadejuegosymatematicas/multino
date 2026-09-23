export function renderTurnPanel(
  container,
  view,
  { emphasize = false, activePlayerId = view.turn.currentPlayerId } = {},
) {
  if (!container) {
    return;
  }
  container.replaceChildren();
  container.classList.toggle("is-turn-feedback", emphasize);
  for (const player of view.participants.players) {
    const teamIndex = view.participants.teams.findIndex(
      (team) => team.teamId === player.teamId,
    );
    const item = document.createElement("div");
    item.className = "player-status";
    item.classList.toggle("is-current", player.playerId === activePlayerId);
    item.dataset.teamIndex = String(teamIndex);
    const avatar = document.createElement("span");
    avatar.className = "player-status__avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = player.displayName.slice(0, 1).toLocaleUpperCase("es");
    const identity = document.createElement("span");
    identity.className = "player-status__identity";
    const nameRow = document.createElement("span");
    nameRow.className = "player-status__name-row";
    const badge = document.createElement("span");
    badge.className = "team-badge";
    badge.dataset.teamId = player.teamId;
    badge.textContent = player.teamId;
    badge.setAttribute("aria-label", `Equipo ${player.teamId}`);
    const name = document.createElement("strong");
    name.textContent = player.displayName;
    nameRow.append(badge, name);
    identity.append(nameRow);
    const remaining = document.createElement("span");
    remaining.className = "player-status__remaining";
    remaining.setAttribute(
      "aria-label",
      `${player.remainingDominoCount} fichas restantes`,
    );
    remaining.innerHTML = `<span aria-hidden="true">▰</span>${player.remainingDominoCount}`;
    item.append(avatar, identity, remaining);
    container.append(item);
  }
  if (
    view.roundStatus.phase !== "finished" &&
    view.turn.consecutivePasses > 0
  ) {
    const detail = document.createElement("span");
    detail.className = "turn-pass-streak";
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
