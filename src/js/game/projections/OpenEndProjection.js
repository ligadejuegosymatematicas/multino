import { getOpenEndTargets } from "../engine/BoardQueries.js";

/** Agrupa destinos sin perder su identidad placementId:portId. */
export function groupOpenEndsByValue(state) {
  const groups = {};
  for (const target of getOpenEndTargets(state)) {
    groups[target.value] ??= [];
    groups[target.value].push(target);
  }
  return groups;
}

/** Contrato sin geometría: un elemento representa las curvas de un valor. */
export function getOpenEndVisualProjection(state) {
  const groups = groupOpenEndsByValue(state);
  return Object.entries(groups)
    .map(([value, targets]) => ({
      value: Number(value),
      count: targets.length,
      targets,
    }))
    .sort((first, second) => first.value - second.value);
}
