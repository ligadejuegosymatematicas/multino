import { domainAssert } from "../errors/DomainError.js";
import { validateBoardState } from "../engine/BoardValidator.js";
import { getLatestActionProjection } from "./ActionProjection.js";
import { getLegalPlayProjection } from "./LegalPlayProjection.js";
import { getOpenEndVisualProjection } from "./OpenEndProjection.js";
import { getScoringProjection } from "./ScoringProjection.js";
import { getValueGraphProjection } from "./ValueGraphProjection.js";

/** Fachada compuesta y descartable para un futuro GraphRenderer. */
export function projectGraphView(state, playerId = state.currentPlayerId) {
  validateBoardState(state);
  domainAssert(
    Array.isArray(state.hands[playerId]),
    "UNKNOWN_PLAYER_HAND",
    `No existe una mano para el jugador ${String(playerId)}.`,
    { playerId },
  );
  const graph = getValueGraphProjection(state);
  const openEndsByValue = getOpenEndVisualProjection(state);
  const openTargetCountByValue = new Map(
    openEndsByValue.map((group) => [group.value, group.count]),
  );
  const legalPlays = getLegalPlayProjection(state, playerId);
  const legalTargetCountByDominoId = new Map(
    legalPlays.map((play) => [play.dominoId, play.legalTargetCount]),
  );

  return {
    vertices: graph.vertices.map((vertex) => ({
      ...vertex,
      openTargetCount: openTargetCountByValue.get(vertex.value) ?? 0,
    })),
    edges: graph.edges,
    openEndsByValue,
    hand: state.hands[playerId].map((dominoId) => {
      const domino = state.dominoes[dominoId];
      const [a, b] = domino.sides.map((side) => side.value);
      return {
        dominoId,
        a,
        b,
        isLoop: a === b,
        legalTargetCount: legalTargetCountByDominoId.get(dominoId) ?? 0,
      };
    }),
    legalPlays,
    scoring: getScoringProjection(state),
    participants: {
      players: state.seating.counterclockwisePlayerIds.map((seatedPlayerId) => {
        const player = state.players[seatedPlayerId];
        return {
          playerId: seatedPlayerId,
          displayName: player.displayName ?? seatedPlayerId,
          teamId: player.teamId,
          remainingDominoCount: state.hands[seatedPlayerId].length,
          isCurrentPlayer: seatedPlayerId === state.currentPlayerId,
        };
      }),
      teams: Object.values(state.teams).map((team) => ({
        teamId: team.id,
        displayName: team.displayName ?? team.id,
        score: state.score.teams[team.id],
      })),
    },
    latestAction: getLatestActionProjection(state),
    turn: {
      currentPlayerId: state.currentPlayerId,
      projectedPlayerId: playerId,
      turnNumber: state.turnNumber,
      consecutivePasses: state.consecutivePasses,
      isCurrentPlayer:
        state.phase === "playing" && playerId === state.currentPlayerId,
    },
    roundStatus: {
      phase: state.phase,
      scoreByTeam: structuredClone(state.score.teams),
      roundResult: Object.hasOwn(state, "roundResult")
        ? structuredClone(state.roundResult)
        : null,
    },
  };
}
