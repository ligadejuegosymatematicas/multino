export function resolvePresentedFeedback({
  nextFeedback = null,
  lastFeedbackSequence = null,
  activeFeedback = null,
} = {}) {
  if (activeFeedback?.scoring) {
    return activeFeedback;
  }
  return nextFeedback?.sequence !== lastFeedbackSequence
    ? nextFeedback
    : null;
}

export function isPresentationBarrierActive({
  feedback = null,
  presentationQueue = null,
  roundResultPending = false,
} = {}) {
  return Boolean(
    feedback?.scoring ||
    presentationQueue?.isBusy ||
    roundResultPending
  );
}

export function getOnlineIdleTurnMessage({
  isFinished = false,
  currentPlayerId = null,
  players = [],
  seats = [],
} = {}) {
  if (isFinished) return "";
  const currentPlayer = players.find(
    (player) => player.playerId === currentPlayerId,
  );
  const currentSeat = seats.find(
    (seat) => seat.seatId === currentPlayerId,
  );
  const displayName = currentPlayer?.displayName ?? currentSeat?.nick ?? "Jugador";
  return currentSeat?.controlType === "CPU"
    ? `${displayName} está jugando…`
    : `Turno de ${displayName}`;
}

export function getPresentedActivePlayerId({
  isFinished = false,
  roundResultDeferred = false,
  feedbackPlayerId = null,
  presentationActorId = null,
  currentPlayerId = null,
} = {}) {
  if (isFinished && !roundResultDeferred) return null;
  return feedbackPlayerId ?? presentationActorId ?? currentPlayerId;
}

export function getLocalCpuPresentationDelay({
  state,
  scoringDurationMs,
  initialDelayMs = 650,
  ordinaryDelayMs = 850,
  postScoringPauseMs = 550,
} = {}) {
  if (!state?.history?.length) return initialDelayMs;
  const latest = state.history.at(-1);
  return latest?.type === "PLAY_DOMINO"
    ? scoringDurationMs + postScoringPauseMs
    : ordinaryDelayMs;
}
