import { domainAssert } from "../errors/DomainError.js";
import { isDouble } from "../model/Domino.js";

export const ORDINARY_PORT_IDS = Object.freeze(["side:a", "side:b"]);
export const SPECIAL_DOUBLE_PORT_IDS = Object.freeze([
  "main:1",
  "main:2",
  "branch:1",
  "branch:2",
]);
export const SPECIAL_MAIN_PORT_IDS = Object.freeze(["main:1", "main:2"]);
export const SPECIAL_BRANCH_PORT_IDS = Object.freeze([
  "branch:1",
  "branch:2",
]);

export function isSpecialDoublePlacement(state, placementId) {
  return state.board.specialDoublePlacementIds.includes(placementId);
}

export function getPlacementDomino(state, placementId) {
  const placement = state.board?.placements?.[placementId];
  domainAssert(
    placement,
    "UNKNOWN_PLACEMENT",
    `No existe la colocación ${String(placementId)}.`,
    { placementId },
  );

  const domino = state.dominoes?.[placement.dominoId];
  domainAssert(
    domino,
    "UNKNOWN_PLACEMENT_DOMINO",
    `La colocación ${placementId} referencia una ficha inexistente.`,
    { placementId, dominoId: placement.dominoId },
  );

  return domino;
}

/** DEC-026: proyecta puertos lógicos sin geometría. */
export function getPlacementPorts(state, placementId) {
  const domino = getPlacementDomino(state, placementId);

  if (isSpecialDoublePlacement(state, placementId)) {
    domainAssert(
      isDouble(domino),
      "INVALID_SPECIAL_DOUBLE",
      `La colocación especial ${placementId} no contiene un chancho.`,
      { placementId, dominoId: domino.id },
    );
    const value = domino.sides[0].value;
    return [
      { id: "main:1", value, role: "main", physicalSideId: "a" },
      { id: "main:2", value, role: "main", physicalSideId: "b" },
      { id: "branch:1", value, role: "branch", physicalSideId: null },
      { id: "branch:2", value, role: "branch", physicalSideId: null },
    ];
  }

  return domino.sides.map((side) => ({
    id: `side:${side.id}`,
    value: side.value,
    role: "ordinary",
    physicalSideId: side.id,
  }));
}

export function getPlacementPort(state, placementId, portId) {
  const port = getPlacementPorts(state, placementId).find(
    (candidate) => candidate.id === portId,
  );
  domainAssert(
    port,
    "UNKNOWN_PLACEMENT_PORT",
    `La colocación ${placementId} no expone el puerto ${String(portId)}.`,
    { placementId, portId },
  );
  return port;
}

export function getPrincipalPortIds(state, placementId) {
  return isSpecialDoublePlacement(state, placementId)
    ? [...SPECIAL_MAIN_PORT_IDS]
    : [...ORDINARY_PORT_IDS];
}
