import { domainAssert } from "../errors/DomainError.js";
import { validateBoardState } from "../engine/BoardValidator.js";
import { getOpenEndVisualProjection } from "./OpenEndProjection.js";
import { projectRoundView } from "./RoundViewProjection.js";
import { getBoardTopologyProjection } from "./TopologyProjection.js";
import { getValueGraphProjection } from "./ValueGraphProjection.js";

/** Fachada compuesta y descartable para GraphRenderer. */
export function projectGraphView(state, playerId = state.currentPlayerId) {
  validateBoardState(state);
  const graph = getValueGraphProjection(state);
  const topology = getBoardTopologyProjection(state);
  const openTargetTopologyById = new Map(
    topology.openTargets.map((target) => [target.targetId, target]),
  );
  const openEndsByValue = getOpenEndVisualProjection(state).map((group) => ({
    ...group,
    targets: group.targets.map((target) => {
      const targetTopology = openTargetTopologyById.get(target.id);
      domainAssert(
        targetTopology !== undefined,
        "MISSING_OPEN_TARGET_TOPOLOGY",
        `No existe clasificación topológica para el destino ${target.id}.`,
        { targetId: target.id },
      );
      return { ...target, topology: targetTopology };
    }),
  }));
  const openTargetCountByValue = new Map(
    openEndsByValue.map((group) => [group.value, group.count]),
  );

  return {
    vertices: graph.vertices.map((vertex) => ({
      ...vertex,
      openTargetCount: openTargetCountByValue.get(vertex.value) ?? 0,
    })),
    edges: graph.edges,
    topology,
    openEndsByValue,
    ...projectRoundView(state, playerId),
  };
}
