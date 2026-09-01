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
  if (latest.type === "PLAY_DOMINO" && latest.scoreAwarded > 0) {
    messages.push(`+${latest.scoreAwarded} puntos para ${teamName(view, latest.teamId)}`);
  }

  let openedBranchFamily = null;
  if (latest.type === "PLAY_DOMINO") {
    const placement = view.topology.placements.find(
      (candidate) => candidate.placementId === latest.placementId,
    );
    if (placement?.region === "branch" && placement.depth === 1) {
      openedBranchFamily = placement.familyLabel;
      messages.push(`${placement.familyLabel} abierta`);
    }
  }

  return {
    sequence: latest.sequence,
    playerId: latest.playerId,
    teamId: latest.teamId,
    scoreAwarded: latest.type === "PLAY_DOMINO"
      ? latest.scoreAwarded ?? 0
      : 0,
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
  container.textContent = feedback?.message ?? "";
  container.classList.toggle(
    "is-score-feedback",
    (feedback?.scoreAwarded ?? 0) > 0,
  );
  container.classList.toggle(
    "is-branch-feedback",
    feedback?.openedBranchFamily !== null &&
      feedback?.openedBranchFamily !== undefined,
  );
}
