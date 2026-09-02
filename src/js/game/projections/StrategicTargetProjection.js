import { domainAssert } from "../errors/DomainError.js";
import { getOpenEndTargets } from "../engine/BoardQueries.js";
import { getLegalPlays } from "../engine/LegalPlays.js";
import { validateRoundState } from "../engine/RoundValidator.js";
import { applyTurnAction } from "../engine/TurnManager.js";
import { getScoringPresentation } from "./ScoringPresentation.js";
import { getBoardTopologyProjection } from "./TopologyProjection.js";

function targetId(target) {
  return target.kind === "START"
    ? "START"
    : `${target.placementId}:${target.portId}`;
}

function projectOpenTargets(state) {
  const topologyByTargetId = new Map(
    getBoardTopologyProjection(state).openTargets.map((target) => [
      target.targetId,
      target,
    ]),
  );
  return getOpenEndTargets(state).map((target) => ({
    ...structuredClone(target),
    topology: structuredClone(topologyByTargetId.get(target.id)),
  }));
}

function projectContinuation(target) {
  if (target.kind === "START") {
    return {
      region: "start",
      structureCode: null,
      familyId: null,
      familyCode: null,
      armIndex: null,
      branchState: null,
    };
  }
  return {
    region: target.topology.region,
    structureCode: target.topology.structureCode,
    familyId: target.topology.familyId,
    familyCode: target.topology.familyCode,
    armIndex: target.topology.armIndex,
    branchState: target.topology.branchState,
  };
}

function getTargetChanges(beforeTargets, afterTargets) {
  const beforeById = new Map(beforeTargets.map((target) => [target.id, target]));
  const afterById = new Map(afterTargets.map((target) => [target.id, target]));
  return {
    opened: afterTargets
      .filter((target) => !beforeById.has(target.id))
      .map((target) => structuredClone(target)),
    closed: beforeTargets
      .filter((target) => !afterById.has(target.id))
      .map((target) => structuredClone(target)),
  };
}

/**
 * Anticipa, sin mutar ni persistir, las consecuencias exactas de cada target
 * legal para una ficha del jugador actual. La UI normal no consume el bloque
 * `scoring`: queda disponible para ayudas optativas futuras.
 */
export function getStrategicTargetProjections(
  state,
  playerId,
  dominoId,
) {
  validateRoundState(state);
  if (state.phase === "finished") {
    return [];
  }
  domainAssert(
    playerId === state.currentPlayerId,
    "STRATEGIC_PROJECTION_WRONG_TURN",
    "La proyección estratégica solo anticipa acciones del jugador actual.",
    { playerId, currentPlayerId: state.currentPlayerId },
  );

  const beforeTargets = projectOpenTargets(state);
  const beforeTargetById = new Map(
    beforeTargets.map((target) => [target.id, target]),
  );
  return getLegalPlays(state, playerId)
    .filter((play) => play.dominoId === dominoId)
    .map((action) => {
      const projectedTarget = action.target.kind === "START"
        ? { kind: "START" }
        : structuredClone(beforeTargetById.get(targetId(action.target)));
      domainAssert(
        projectedTarget !== undefined,
        "MISSING_STRATEGIC_TARGET",
        "No existe el destino abierto de una jugada legal proyectada.",
        { target: action.target },
      );

      const nextState = applyTurnAction(state, action);
      const resultingOpenEnds = projectOpenTargets(nextState);
      const scoring = getScoringPresentation(nextState).latestResolution;
      domainAssert(
        scoring !== null,
        "MISSING_STRATEGIC_SCORING_RESOLUTION",
        "La transición anticipada no produjo su resolución de puntuación.",
        { dominoId, target: action.target },
      );

      return {
        playerId,
        dominoId,
        action: structuredClone(action),
        target: projectedTarget,
        continuation: projectContinuation(projectedTarget),
        opensBranchArm:
          projectedTarget.kind !== "START" &&
          projectedTarget.topology.region === "branch" &&
          projectedTarget.topology.branchState === "POTENTIAL",
        scoring: structuredClone(scoring),
        resultingOpenEnds,
        openEndChanges: getTargetChanges(beforeTargets, resultingOpenEnds),
        endsRound: nextState.phase === "finished",
      };
    });
}
