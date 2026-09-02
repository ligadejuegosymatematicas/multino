import { domainAssert } from "../errors/DomainError.js";
import { validateBoardState } from "../engine/BoardValidator.js";
import { getLatestActionProjection } from "./ActionProjection.js";
import { getLegalPlayProjection } from "./LegalPlayProjection.js";
import { getScoringProjection } from "./ScoringProjection.js";
import { getScoringPresentation } from "./ScoringPresentation.js";

/**
 * Datos reglamentarios compartidos por cualquier representación visual.
 * No contiene geometría ni una interpretación particular del tablero.
 */
export function projectRoundView(state, playerId = state.currentPlayerId) {
  validateBoardState(state);
  domainAssert(
    Array.isArray(state.hands[playerId]),
    "UNKNOWN_PLAYER_HAND",
    `No existe una mano para el jugador ${String(playerId)}.`,
    { playerId },
  );

  const legalPlays = getLegalPlayProjection(state, playerId);
  const legalTargetCountByDominoId = new Map(
    legalPlays.map((play) => [play.dominoId, play.legalTargetCount]),
  );

  return {
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
    scoringPresentation: getScoringPresentation(state),
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
