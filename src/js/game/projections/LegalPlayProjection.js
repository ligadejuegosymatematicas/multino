import { domainAssert } from "../errors/DomainError.js";
import { getOpenEndTargets } from "../engine/BoardQueries.js";
import { validateBoardState } from "../engine/BoardValidator.js";
import { getLegalPlays } from "../engine/LegalPlays.js";

function targetKey(target) {
  return `${target.placementId}:${target.portId}`;
}

function getProjectionContext(state, playerId) {
  validateBoardState(state);
  domainAssert(
    Array.isArray(state.hands[playerId]),
    "UNKNOWN_PLAYER_HAND",
    `No existe una mano para el jugador ${String(playerId)}.`,
    { playerId },
  );
  if (state.phase === "finished") {
    return { plays: [], openTargetsByKey: new Map() };
  }
  return {
    plays: getLegalPlays(state, playerId),
    openTargetsByKey: new Map(
      getOpenEndTargets(state).map((target) => [target.id, target]),
    ),
  };
}

function projectTarget(playTarget, openTargetsByKey) {
  if (playTarget.kind === "START") {
    return { kind: "START" };
  }
  return structuredClone(openTargetsByKey.get(targetKey(playTarget)));
}

/** Devuelve solo las fichas jugables, en el mismo orden de la mano. */
export function getLegalPlayProjection(state, playerId) {
  const { plays, openTargetsByKey } = getProjectionContext(state, playerId);
  const playsByDominoId = new Map();
  for (const play of plays) {
    if (!playsByDominoId.has(play.dominoId)) {
      playsByDominoId.set(play.dominoId, []);
    }
    playsByDominoId
      .get(play.dominoId)
      .push(projectTarget(play.target, openTargetsByKey));
  }
  return state.hands[playerId]
    .filter((dominoId) => playsByDominoId.has(dominoId))
    .map((dominoId) => {
      const legalTargets = playsByDominoId.get(dominoId);
      return {
        dominoId,
        legalTargetCount: legalTargets.length,
        legalTargets,
      };
    });
}

/** Resuelve los destinos concretos que la UI puede resaltar para una ficha. */
export function getLegalTargetsForDomino(state, playerId, dominoId) {
  const projectedPlay = getLegalPlayProjection(state, playerId).find(
    (entry) => entry.dominoId === dominoId,
  );
  return projectedPlay?.legalTargets ?? [];
}
