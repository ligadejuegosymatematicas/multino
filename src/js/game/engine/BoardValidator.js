import { domainAssert } from "../errors/DomainError.js";
import { isDouble } from "../model/Domino.js";
import { isBranchedRound } from "../setup/MatchConfig.js";
import {
  getPlacementPort,
  getPlacementPorts,
  getPrincipalPortIds,
  isSpecialDoublePlacement,
} from "./BoardPorts.js";
import {
  getConnectionEndpoints,
} from "./BoardTopology.js";
import { parseSequentialId } from "./SequentialIds.js";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertCanonicalRecordIds(records, prefix, code) {
  const numbers = [];
  for (const [key, record] of Object.entries(records)) {
    const number = parseSequentialId(key, prefix);
    domainAssert(
      number !== null && record?.id === key,
      code,
      `Cada ${prefix} debe usar una clave e ID canónicos ${prefix}-N.`,
      { key, record },
    );
    numbers.push(number);
  }
  numbers.sort((first, second) => first - second);
  domainAssert(
    numbers.every((number, index) => number === index + 1),
    code,
    `Los IDs ${prefix}-N deben formar una secuencia continua.`,
    { numbers },
  );
}

function connectionPairKey(firstPlacementId, secondPlacementId) {
  return [firstPlacementId, secondPlacementId].sort().join("|");
}

function assertDominoLocations(state, placedDominoIds) {
  domainAssert(
    isRecord(state.hands),
    "INVALID_HANDS",
    "hands debe ser un mapa de arrays.",
  );

  const handOccurrences = new Map();
  for (const [playerId, hand] of Object.entries(state.hands)) {
    domainAssert(
      Array.isArray(hand),
      "INVALID_HANDS",
      `La mano de ${playerId} debe ser un array.`,
      { playerId, hand },
    );
    for (const dominoId of hand) {
      domainAssert(
        Object.hasOwn(state.dominoes, dominoId),
        "UNKNOWN_HAND_DOMINO",
        `La mano de ${playerId} contiene una ficha inexistente.`,
        { playerId, dominoId },
      );
      handOccurrences.set(
        dominoId,
        (handOccurrences.get(dominoId) ?? 0) + 1,
      );
    }
  }

  for (const dominoId of Object.keys(state.dominoes)) {
    const inHands = handOccurrences.get(dominoId) ?? 0;
    const onBoard = placedDominoIds.has(dominoId) ? 1 : 0;
    domainAssert(
      !(inHands > 0 && onBoard > 0),
      "DOMINO_IN_MULTIPLE_LOCATIONS",
      `La ficha ${dominoId} aparece en una mano y en el tablero.`,
      { dominoId, inHands, onBoard },
    );
    domainAssert(
      inHands + onBoard === 1,
      "INVALID_DOMINO_LOCATION",
      `La ficha ${dominoId} debe aparecer exactamente en una ubicación.`,
      { dominoId, inHands, onBoard },
    );
  }
}

function assertHistory(state) {
  domainAssert(
    Array.isArray(state.history),
    "INVALID_HISTORY",
    "history debe ser un array.",
  );

  state.history.forEach((entry, index) => {
    domainAssert(
      entry?.sequence === index + 1,
      "INVALID_HISTORY_SEQUENCE",
      "Las secuencias históricas deben ser continuas desde 1.",
      { entry, index },
    );
  });

  const playEntries = state.history.filter(
    (entry) => entry.type === "PLAY_DOMINO",
  );
  domainAssert(
    playEntries.length === Object.keys(state.board.placements).length,
    "INVALID_PLAY_HISTORY",
    "Debe existir una acción PLAY_DOMINO por cada colocación.",
    { playCount: playEntries.length },
  );

  const seenPlacements = new Set();
  for (const entry of playEntries) {
    const placementId = entry.result?.placementId;
    const placement = state.board.placements[placementId];
    domainAssert(
      placement &&
        !seenPlacements.has(placementId) &&
        placement.dominoId === entry.payload?.dominoId,
      "INVALID_PLAY_HISTORY",
      "Una acción histórica no coincide con su colocación.",
      { entry },
    );
    const placementNumber = parseSequentialId(placementId, "placement");
    const expectedConnectionId =
      placementNumber === 1 ? null : `connection-${placementNumber - 1}`;
    domainAssert(
      entry.result?.connectionId === expectedConnectionId,
      "INVALID_PLAY_HISTORY",
      "El resultado histórico no coincide con la conexión de la jugada.",
      { entry, expectedConnectionId },
    );
    seenPlacements.add(placementId);
  }
}

/** Valida el subconjunto topológico de un snapshot activo o terminado. */
export function validateBoardState(state) {
  domainAssert(
    isRecord(state) && ["playing", "finished"].includes(state.phase),
    "INVALID_PLAYABLE_STATE",
    "El tablero requiere un snapshot en phase=playing o phase=finished.",
    { phase: state?.phase },
  );
  domainAssert(
    isRecord(state.dominoes) && isRecord(state.board),
    "INVALID_BOARD_STATE",
    "El snapshot debe contener catálogo y tablero.",
  );
  const board = state.board;
  domainAssert(
    isRecord(board.placements) &&
      isRecord(board.connections) &&
      isRecord(board.mainLine) &&
      Array.isArray(board.mainLine.placementIds) &&
      Array.isArray(board.specialDoublePlacementIds) &&
      !Object.hasOwn(board, "branches"),
    "INVALID_BOARD_SHAPE",
    "El tablero no coincide con el esquema lógico vigente.",
    { board },
  );

  assertCanonicalRecordIds(
    board.placements,
    "placement",
    "INVALID_PLACEMENT_ID",
  );
  assertCanonicalRecordIds(
    board.connections,
    "connection",
    "INVALID_CONNECTION_ID",
  );

  const placementIds = Object.keys(board.placements);
  const placedDominoIds = new Set();
  for (const placement of Object.values(board.placements)) {
    domainAssert(
      Object.hasOwn(state.dominoes, placement.dominoId),
      "UNKNOWN_PLACEMENT_DOMINO",
      `La colocación ${placement.id} referencia una ficha inexistente.`,
      { placement },
    );
    domainAssert(
      !placedDominoIds.has(placement.dominoId),
      "DUPLICATE_DOMINO_PLACEMENT",
      `La ficha ${placement.dominoId} aparece en más de una colocación.`,
      { dominoId: placement.dominoId },
    );
    domainAssert(
      !Object.hasOwn(placement, "region") &&
        !Object.hasOwn(placement, "role") &&
        !Object.hasOwn(placement, "orientation"),
      "REDUNDANT_PLACEMENT_STATE",
      "Una colocación no persiste región, rol ni orientación.",
      { placement },
    );
    placedDominoIds.add(placement.dominoId);
  }

  const mainLineIds = board.mainLine.placementIds;
  const mainSet = new Set(mainLineIds);
  domainAssert(
    mainSet.size === mainLineIds.length &&
      mainLineIds.every((placementId) => board.placements[placementId]),
    "INVALID_MAIN_LINE_PATH",
    "mainLine debe contener colocaciones existentes sin duplicados.",
    { mainLineIds },
  );
  domainAssert(
    (placementIds.length === 0 && mainLineIds.length === 0) ||
      (placementIds.length > 0 && mainLineIds.length > 0),
    "INVALID_MAIN_LINE_PATH",
    "Un tablero ocupado debe tener una línea principal no vacía.",
  );

  const specialIds = board.specialDoublePlacementIds;
  const branchingEnabled = isBranchedRound(state.config);
  domainAssert(
    new Set(specialIds).size === specialIds.length,
    "INVALID_SPECIAL_DOUBLE",
    "specialDoublePlacementIds no admite duplicados.",
    { specialIds },
  );
  domainAssert(
    specialIds.length <= (branchingEnabled ? 1 : 0),
    "SPECIAL_DOUBLE_LIMIT_EXCEEDED",
    "La ronda admite como máximo un chancho ramificador.",
    { specialIds, branchingEnabled },
  );
  for (const placementId of specialIds) {
    const placement = board.placements[placementId];
    domainAssert(
      placement &&
        mainSet.has(placementId) &&
        isDouble(state.dominoes[placement.dominoId]),
      "INVALID_SPECIAL_DOUBLE",
      "La lista especial solo puede contener el primer chancho colocado.",
      { placementId },
    );
  }

  const expectedSpecialIds = placementIds
    .filter((placementId) => {
      const placement = board.placements[placementId];
      return isDouble(state.dominoes[placement.dominoId]);
    })
    .sort(
      (first, second) =>
        parseSequentialId(first, "placement") -
        parseSequentialId(second, "placement"),
    )
    .slice(0, branchingEnabled ? 1 : 0);
  domainAssert(
    JSON.stringify(specialIds) === JSON.stringify(expectedSpecialIds),
    "INVALID_SPECIAL_DOUBLE_ORDER",
    "La lista especial debe identificar exclusivamente el primer chancho colocado.",
    { specialIds, expectedSpecialIds },
  );

  const portUsage = new Map();
  const degreeByPlacement = new Map(
    placementIds.map((placementId) => [placementId, 0]),
  );
  for (const connection of Object.values(board.connections)) {
    domainAssert(
      isRecord(connection.from) &&
        isRecord(connection.to) &&
        connection.from.placementId !== connection.to.placementId,
      "INVALID_CONNECTION_ENDPOINTS",
      "Una conexión debe unir dos colocaciones distintas.",
      { connection },
    );

    const endpoints = getConnectionEndpoints(connection);
    for (const endpoint of endpoints) {
      domainAssert(
        board.placements[endpoint.placementId],
        "UNKNOWN_CONNECTION_PLACEMENT",
        "Una conexión referencia una colocación inexistente.",
        { connectionId: connection.id, endpoint },
      );

      const special = isSpecialDoublePlacement(state, endpoint.placementId);
      const inMainLine = mainSet.has(endpoint.placementId);
      if (!special && String(endpoint.portId).startsWith("branch:")) {
        domainAssert(
          inMainLine,
          "SECOND_LEVEL_BRANCH",
          "Una colocación de ramificación no puede exponer branch:*.",
          { endpoint },
        );
        domainAssert(
          false,
          "ORDINARY_DOUBLE_BRANCH_PORT",
          "Solo un chancho especial puede usar branch:*.",
          { endpoint },
        );
      }
      if (!special && String(endpoint.portId).startsWith("main:")) {
        domainAssert(
          false,
          "INVALID_ORDINARY_PORT",
          "Una colocación ordinaria solo usa side:a y side:b.",
          { endpoint },
        );
      }

      getPlacementPort(state, endpoint.placementId, endpoint.portId);
      degreeByPlacement.set(
        endpoint.placementId,
        degreeByPlacement.get(endpoint.placementId) + 1,
      );
    }

    for (const endpoint of endpoints) {
      const degree = degreeByPlacement.get(endpoint.placementId);
      const maximum = isSpecialDoublePlacement(state, endpoint.placementId)
        ? 4
        : 2;
      domainAssert(
        degree <= maximum,
        isSpecialDoublePlacement(state, endpoint.placementId)
          ? "SPECIAL_DOUBLE_CONNECTION_LIMIT"
          : "ORDINARY_PLACEMENT_CONNECTION_LIMIT",
        `La colocación ${endpoint.placementId} excede ${maximum} conexiones.`,
        { endpoint, degree, maximum },
      );
    }

    const fromPort = getPlacementPort(
      state,
      connection.from.placementId,
      connection.from.portId,
    );
    const toPort = getPlacementPort(
      state,
      connection.to.placementId,
      connection.to.portId,
    );
    domainAssert(
      fromPort.value === toPort.value,
      "INCOMPATIBLE_CONNECTION_VALUES",
      "Una conexión debe unir puertos con el mismo valor.",
      { connection, fromValue: fromPort.value, toValue: toPort.value },
    );

    for (const endpoint of endpoints) {
      const key = `${endpoint.placementId}:${endpoint.portId}`;
      domainAssert(
        !portUsage.has(key),
        "PORT_ALREADY_CONNECTED",
        `El puerto ${key} participa en más de una conexión.`,
        { connectionId: connection.id, previous: portUsage.get(key) },
      );
      portUsage.set(key, connection.id);
    }
  }

  const mainPairCounts = new Map();
  const mainDegrees = new Map(mainLineIds.map((placementId) => [placementId, 0]));
  const outsideIds = placementIds.filter((placementId) => !mainSet.has(placementId));
  const outsideSet = new Set(outsideIds);
  const outsideAdjacency = new Map(outsideIds.map((placementId) => [placementId, []]));
  const outsideAttachments = new Map(outsideIds.map((placementId) => [placementId, []]));

  for (const connection of Object.values(board.connections)) {
    const fromInMain = mainSet.has(connection.from.placementId);
    const toInMain = mainSet.has(connection.to.placementId);

    if (fromInMain && toInMain) {
      const fromIndex = mainLineIds.indexOf(connection.from.placementId);
      const toIndex = mainLineIds.indexOf(connection.to.placementId);
      domainAssert(
        Math.abs(fromIndex - toIndex) === 1,
        "INVALID_MAIN_LINE_PATH",
        "Una conexión principal solo une colocaciones consecutivas.",
        { connection },
      );
      const fromPrincipal = getPrincipalPortIds(
        state,
        connection.from.placementId,
      );
      const toPrincipal = getPrincipalPortIds(
        state,
        connection.to.placementId,
      );
      domainAssert(
        fromPrincipal.includes(connection.from.portId) &&
          toPrincipal.includes(connection.to.portId),
        "INVALID_MAIN_LINE_PORT",
        "La continuidad principal debe usar puertos principales.",
        { connection },
      );
      const pairKey = connectionPairKey(
        connection.from.placementId,
        connection.to.placementId,
      );
      mainPairCounts.set(pairKey, (mainPairCounts.get(pairKey) ?? 0) + 1);
      mainDegrees.set(
        connection.from.placementId,
        mainDegrees.get(connection.from.placementId) + 1,
      );
      mainDegrees.set(
        connection.to.placementId,
        mainDegrees.get(connection.to.placementId) + 1,
      );
      continue;
    }

    if (fromInMain !== toInMain) {
      const mainEndpoint = fromInMain ? connection.from : connection.to;
      const outsideEndpoint = fromInMain ? connection.to : connection.from;
      const mainPort = getPlacementPort(
        state,
        mainEndpoint.placementId,
        mainEndpoint.portId,
      );
      domainAssert(
        isSpecialDoublePlacement(state, mainEndpoint.placementId) &&
          mainPort.role === "branch",
        "BRANCH_RECONNECTS_MAIN_LINE",
        "Una cadena lateral solo puede tocar mainLine en un branch:* especial.",
        { connection },
      );
      outsideAttachments.get(outsideEndpoint.placementId).push(connection.id);
      continue;
    }

    domainAssert(
      outsideSet.has(connection.from.placementId) &&
        outsideSet.has(connection.to.placementId),
      "INVALID_BRANCH_CONNECTION",
      "Una conexión externa debe pertenecer a una rama.",
      { connection },
    );
    outsideAdjacency.get(connection.from.placementId).push({
      placementId: connection.to.placementId,
      connectionId: connection.id,
    });
    outsideAdjacency.get(connection.to.placementId).push({
      placementId: connection.from.placementId,
      connectionId: connection.id,
    });
  }

  for (let index = 0; index < mainLineIds.length - 1; index += 1) {
    const pairKey = connectionPairKey(mainLineIds[index], mainLineIds[index + 1]);
    domainAssert(
      mainPairCounts.get(pairKey) === 1,
      "INVALID_MAIN_LINE_PATH",
      "Cada par consecutivo de mainLine debe tener exactamente una conexión.",
      { pairKey },
    );
  }
  for (let index = 0; index < mainLineIds.length; index += 1) {
    const expectedDegree =
      mainLineIds.length === 1
        ? 0
        : index === 0 || index === mainLineIds.length - 1
          ? 1
          : 2;
    domainAssert(
      mainDegrees.get(mainLineIds[index]) === expectedDegree,
      "INVALID_MAIN_LINE_PATH",
      "Los grados principales no forman un camino simple.",
      { placementId: mainLineIds[index], expectedDegree },
    );
  }

  const visitedOutside = new Set();
  for (const startingId of outsideIds) {
    if (visitedOutside.has(startingId)) {
      continue;
    }
    const queue = [startingId];
    const component = [];
    let internalEdgesTwice = 0;
    const attachmentIds = [];
    while (queue.length > 0) {
      const placementId = queue.shift();
      if (visitedOutside.has(placementId)) {
        continue;
      }
      visitedOutside.add(placementId);
      component.push(placementId);
      attachmentIds.push(...outsideAttachments.get(placementId));
      const neighbors = outsideAdjacency.get(placementId);
      internalEdgesTwice += neighbors.length;
      for (const neighbor of neighbors) {
        if (!visitedOutside.has(neighbor.placementId)) {
          queue.push(neighbor.placementId);
        }
      }
    }

    domainAssert(
      attachmentIds.length > 0,
      "DISCONNECTED_BRANCH",
      "Toda colocación externa debe pertenecer a una rama conectada.",
      { component },
    );
    domainAssert(
      attachmentIds.length === 1,
      "BRANCHES_CONNECTED",
      "Dos ramificaciones no pueden conectarse entre sí.",
      { component, attachmentIds },
    );
    domainAssert(
      internalEdgesTwice / 2 === component.length - 1,
      "BRANCH_CYCLE",
      "Una ramificación debe ser una cadena sin ciclos.",
      { component },
    );
    const terminalCount = component.filter(
      (placementId) => degreeByPlacement.get(placementId) === 1,
    ).length;
    domainAssert(
      terminalCount === 1,
      "INVALID_BRANCH_TERMINAL",
      "Cada ramificación debe tener un único extremo terminal.",
      { component, terminalCount },
    );
  }

  domainAssert(
    Object.keys(board.connections).length === Math.max(placementIds.length - 1, 0),
    "INVALID_BOARD_CONNECTION_COUNT",
    "El tablero conectado debe tener una conexión menos que colocaciones.",
    {
      placements: placementIds.length,
      connections: Object.keys(board.connections).length,
    },
  );

  assertDominoLocations(state, placedDominoIds);
  assertHistory(state);

  return state;
}
