import { domainAssert } from "../errors/DomainError.js";

/**
 * R-029: devuelve una permutación nueva usando Fisher–Yates.
 * El algoritmo es una decisión técnica; la regla solo exige mezcla aleatoria.
 */
export function shuffle(items, randomSource = Math.random) {
  domainAssert(
    Array.isArray(items),
    "INVALID_SHUFFLE_INPUT",
    "shuffle requiere un array de entrada.",
    { items },
  );
  domainAssert(
    typeof randomSource === "function",
    "INVALID_RANDOM_SOURCE",
    "randomSource debe ser una función.",
  );

  const shuffled = [...items];
  for (let currentIndex = shuffled.length - 1; currentIndex > 0; currentIndex -= 1) {
    const randomValue = randomSource();
    domainAssert(
      typeof randomValue === "number" &&
        Number.isFinite(randomValue) &&
        randomValue >= 0 &&
        randomValue < 1,
      "INVALID_RANDOM_VALUE",
      "randomSource debe devolver un número finito en el intervalo [0, 1).",
      { randomValue },
    );

    const swapIndex = Math.floor(randomValue * (currentIndex + 1));
    [shuffled[currentIndex], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[currentIndex],
    ];
  }

  return shuffled;
}

