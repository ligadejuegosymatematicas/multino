/**
 * Crea un tablero lógico vacío. Sus colecciones forman la base de un grafo de
 * colocaciones y conexiones; no contienen geometría visual.
 */
export function createEmptyBoard() {
  return {
    placements: {},
    connections: {},
    mainLine: {
      placementIds: [],
    },
    specialDoublePlacementIds: [],
  };
}
