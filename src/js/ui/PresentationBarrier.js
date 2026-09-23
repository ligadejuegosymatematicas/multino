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
