import { domainAssert } from "../errors/DomainError.js";
import { getOpenEndTargets } from "../engine/BoardQueries.js";
import { getLegalPlays } from "../engine/LegalPlays.js";
import { validateRoundState } from "../engine/RoundValidator.js";
import { applyTurnAction } from "../engine/TurnManager.js";
import { getScoringPresentation } from "./ScoringPresentation.js";
import { getRoundStructureProjection } from "./RoundStructureProjection.js";
import { getBoardTopologyProjection } from "./TopologyProjection.js";

export const STRATEGIC_DECISION_KINDS = Object.freeze({
  START: "start",
  CONTINUE: "continue",
  COMPLETE_CROSS: "complete-cross",
  OPEN_ARM: "open-arm",
});

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

function getDecisionKind(target, branchingDouble) {
  if (target.kind === "START") {
    return STRATEGIC_DECISION_KINDS.START;
  }
  if (branchingDouble?.placementId !== target.placementId) {
    return STRATEGIC_DECISION_KINDS.CONTINUE;
  }
  if (target.portId.startsWith("branch:")) {
    return STRATEGIC_DECISION_KINDS.OPEN_ARM;
  }
  if (branchingDouble.connectionCount === 1) {
    return STRATEGIC_DECISION_KINDS.COMPLETE_CROSS;
  }
  return STRATEGIC_DECISION_KINDS.CONTINUE;
}

function scoringSignature(scoring) {
  return {
    terms: scoring.terms
      .map(({ value, factor, contribution }) => ({
        value,
        factor,
        contribution,
      }))
      .sort((first, second) =>
        first.value - second.value ||
        first.factor - second.factor ||
        first.contribution - second.contribution
      ),
    sum: scoring.sum,
    divisor: scoring.divisor,
    isDivisible: scoring.isDivisible,
    quotient: scoring.quotient,
    scoreAwarded: scoring.scoreAwarded,
  };
}

function openEndCounts(openEnds) {
  const counts = Array.from({ length: 7 }, () => 0);
  for (const target of openEnds) {
    counts[target.value] += 1;
  }
  return counts;
}

function scoringMultiplicities(scoring) {
  const multiplicities = Array.from({ length: 7 }, () => 0);
  for (const term of scoring.terms) {
    if (
      Number.isSafeInteger(term.value) &&
      term.value >= 0 &&
      term.value <= 6 &&
      Number.isSafeInteger(term.factor) &&
      term.factor > 0
    ) {
      multiplicities[term.value] += term.factor;
    }
  }
  return multiplicities;
}

function valueChanges(before, after) {
  return before.flatMap((count, value) => count === after[value]
    ? []
    : [{ value, before: count, after: after[value], delta: after[value] - count }]
  );
}

function branchingSignature(structure) {
  const branchingDouble = structure.branchingDouble;
  return branchingDouble === null
    ? null
    : {
        value: branchingDouble.value,
        connectionCount: branchingDouble.connectionCount,
        phase: branchingDouble.phase,
        continuationPortsRemaining:
          branchingDouble.continuationPortsRemaining,
        lateralPortsUnlocked: branchingDouble.lateralPortsUnlocked,
        lateralPortsRemaining: branchingDouble.lateralPortsRemaining,
        contributesToScoring: branchingDouble.contributesToScoring,
        isSaturated: branchingDouble.isSaturated,
      };
}

function strategicOutcome(projection) {
  return {
    scoring: scoringSignature(projection.scoring),
    openTargetCountByValue: openEndCounts(projection.resultingOpenEnds),
    branchingDouble: branchingSignature(projection.resultingStructure),
    terminal: projection.terminal,
  };
}

function targetValue(projection) {
  return projection.target.kind === "START" ? null : projection.target.value;
}

function publicEffects({
  beforeScoring,
  afterScoring,
  beforeTargets,
  afterTargets,
  beforeStructure,
  afterStructure,
  endsRound,
}) {
  const beforeBranching = beforeStructure.branchingDouble;
  const afterBranching = afterStructure.branchingDouble;
  const completesCross = beforeBranching?.connectionCount === 1 &&
    afterBranching?.connectionCount === 2;
  const unlockedLateralCount =
    beforeBranching?.lateralPortsUnlocked === false &&
      afterBranching?.lateralPortsUnlocked === true
      ? afterBranching.lateralPortsRemaining
      : 0;
  const beforeRamifierScoring = beforeBranching?.contributesToScoring
    ? 2
    : 0;
  const afterRamifierScoring = afterBranching?.contributesToScoring
    ? 2
    : 0;
  return {
    scoringMultiplicityChanges: valueChanges(
      scoringMultiplicities(beforeScoring),
      scoringMultiplicities(afterScoring),
    ),
    openTargetChangesByValue: valueChanges(
      openEndCounts(beforeTargets),
      openEndCounts(afterTargets),
    ),
    completesCross,
    unlockedLateralCount,
    ramifierScoringChange:
      beforeBranching?.value === afterBranching?.value &&
        beforeRamifierScoring !== afterRamifierScoring
        ? {
            value: afterBranching.value,
            before: beforeRamifierScoring,
            after: afterRamifierScoring,
          }
        : null,
    branchingConnectionCountBefore: beforeBranching?.connectionCount ?? null,
    branchingConnectionCountAfter: afterBranching?.connectionCount ?? null,
    endsRound,
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
  const beforeStructure = getRoundStructureProjection(state);
  const beforeScoring = getScoringPresentation(state);
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
      const resultingStructure = getRoundStructureProjection(nextState);
      const scoring = getScoringPresentation(nextState).latestResolution;
      domainAssert(
        scoring !== null,
        "MISSING_STRATEGIC_SCORING_RESOLUTION",
        "La transición anticipada no produjo su resolución de puntuación.",
        { dominoId, target: action.target },
      );

      const effects = publicEffects({
        beforeScoring,
        afterScoring: scoring,
        beforeTargets,
        afterTargets: resultingOpenEnds,
        beforeStructure,
        afterStructure: resultingStructure,
        endsRound: nextState.phase === "finished",
      });

      return {
        playerId,
        dominoId,
        action: structuredClone(action),
        target: projectedTarget,
        continuation: projectContinuation(projectedTarget),
        decisionKind: getDecisionKind(
          projectedTarget,
          beforeStructure.branchingDouble,
        ),
        opensBranchArm:
          projectedTarget.kind !== "START" &&
          projectedTarget.topology.region === "branch" &&
          projectedTarget.topology.branchState === "POTENTIAL",
        scoring: structuredClone(scoring),
        effects,
        resultingOpenEnds,
        resultingStructure,
        openEndChanges: getTargetChanges(beforeTargets, resultingOpenEnds),
        endsRound: nextState.phase === "finished",
        terminal: nextState.phase === "finished"
          ? {
              reason: nextState.roundResult.reason,
              winnerTeamId: nextState.roundResult.winnerTeamId,
              isTie: nextState.roundResult.isTie,
            }
          : null,
      };
    });
}

/**
 * Agrupa targets físicos que producen la misma consecuencia reglamentaria
 * observable. Conserva todas las acciones exactas y elige una canónica de
 * forma determinista, sin revelar el resultado futuro en la UI normal.
 */
export function getStrategicDecisionGroups(state, playerId, dominoId) {
  const projections = getStrategicTargetProjections(state, playerId, dominoId);
  const groupsByKey = new Map();

  for (const projection of projections) {
    const value = targetValue(projection);
    const outcome = strategicOutcome(projection);
    const key = JSON.stringify({ value, outcome });
    const existing = groupsByKey.get(key);
    if (existing) {
      existing.projections.push(projection);
      continue;
    }
    groupsByKey.set(key, {
      value,
      decisionKind: projection.decisionKind,
      outcome,
      effects: projection.effects,
      projections: [projection],
    });
  }

  return [...groupsByKey.values()].map((group, index) => {
    const ordered = [...group.projections].sort((first, second) =>
      targetId(first.action.target).localeCompare(targetId(second.action.target))
    );
    return {
      id: `strategic-decision:${group.value ?? "start"}:${index + 1}`,
      value: group.value,
      decisionKind: group.decisionKind,
      physicalTargetCount: ordered.length,
      isEquivalentGroup: ordered.length > 1,
      canonicalTarget: structuredClone(ordered[0].action.target),
      targets: ordered.map((projection) =>
        structuredClone(projection.action.target)
      ),
      outcome: structuredClone(group.outcome),
      effects: structuredClone(group.effects),
    };
  });
}
