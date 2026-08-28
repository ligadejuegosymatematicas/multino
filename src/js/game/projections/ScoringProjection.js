import { getScoringTerms } from "../engine/Scoring.js";

/** Explica S actual; no simula ni anuncia puntuación de una acción futura. */
export function getScoringProjection(state) {
  const terms = getScoringTerms(state);
  const sum = terms.reduce((total, term) => total + term.contribution, 0);
  const groupCounts = new Map();
  for (const term of terms) {
    groupCounts.set(
      term.contribution,
      (groupCounts.get(term.contribution) ?? 0) + 1,
    );
  }
  const contributionGroups = [...groupCounts.entries()]
    .map(([contribution, count]) => ({
      contribution,
      count,
      subtotal: contribution * count,
    }))
    .sort((first, second) => first.contribution - second.contribution);

  return { terms, sum, contributionGroups };
}
