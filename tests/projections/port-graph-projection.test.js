import assert from "node:assert/strict";
import test from "node:test";

import {
  getOpenEndTargets,
  getPortGraphProjection,
  projectPortView,
} from "../../src/js/game/index.js";
import {
  createBoardScenario,
  playDomino,
} from "../fixtures/board-scenarios.js";

const CHAIN_DOMINOES = Object.freeze([
  "1-6",
  "1-4",
  "0-4",
  "0-2",
  "2-5",
  "3-5",
  "1-3",
  "1-2",
  "2-4",
  "4-6",
  "0-6",
  "0-5",
]);
const CHAIN_VALUES = Object.freeze([6, 1, 4, 0, 2, 5, 3, 1, 2, 4, 6, 0, 5]);

function targetAt(placementId, portId) {
  return (target) =>
    target.placementId === placementId && target.portId === portId;
}

function createRepeatedValueChain() {
  let state = createBoardScenario({ K: 7, firstDominoId: CHAIN_DOMINOES[0] });
  state = playDomino(state, CHAIN_DOMINOES[0]);
  for (let index = 1; index < CHAIN_DOMINOES.length; index += 1) {
    const sharedValue = CHAIN_VALUES[index];
    state = playDomino(
      state,
      CHAIN_DOMINOES[index],
      (target) => target.kind === "main" && target.value === sharedValue,
    );
  }
  return state;
}

function traceProjectedPath(projection, startingTarget) {
  const adjacency = new Map();
  const add = (firstId, secondId, kind) => {
    const edge = { firstId, secondId, kind };
    adjacency.set(firstId, [...(adjacency.get(firstId) ?? []), edge]);
    adjacency.set(secondId, [...(adjacency.get(secondId) ?? []), edge]);
  };
  for (const thread of projection.externalThreads) {
    add(thread.fromPortId, thread.toPortId, "thread");
  }
  for (const bridge of projection.internalBridges) {
    add(bridge.first.id, bridge.second.id, "bridge");
  }

  const endpointValues = new Map();
  for (const node of projection.macroNodes) {
    for (const port of node.ordinaryPorts) {
      endpointValues.set(port.id, port.value);
    }
  }
  for (const hub of projection.doubleHubs) {
    for (const socket of hub.sockets) {
      endpointValues.set(socket.id, socket.value);
    }
  }

  const values = [startingTarget.value];
  const visited = new Set();
  let currentId = startingTarget.endpoint.id;
  while (true) {
    const edge = (adjacency.get(currentId) ?? []).find(
      (candidate) => !visited.has(candidate),
    );
    if (!edge) {
      break;
    }
    visited.add(edge);
    currentId = edge.firstId === currentId ? edge.secondId : edge.firstId;
    if (edge.kind === "thread") {
      values.push(endpointValues.get(currentId));
    }
  }
  return { values, visitedEdgeCount: visited.size, terminalEndpointId: currentId };
}

test("proyecta siempre siete macro-nodos y seis puertos canónicos por valor", () => {
  const state = createBoardScenario();
  const before = structuredClone(state);
  const projection = getPortGraphProjection(state);

  assert.deepEqual(projection.macroNodes.map(({ id }) => id), [
    "B_0", "B_1", "B_2", "B_3", "B_4", "B_5", "B_6",
  ]);
  for (const node of projection.macroNodes) {
    assert.equal(node.ordinaryPorts.length, 6);
    assert.deepEqual(
      node.ordinaryPorts.map(({ id }) => id),
      [0, 1, 2, 3, 4, 5, 6]
        .filter((value) => value !== node.value)
        .map((value) => `p:${node.value}->${value}`),
    );
    assert.ok(node.ordinaryPorts.every((port) => port.state === "POTENTIAL"));
  }
  assert.deepEqual(state, before);
});

test("una ficha no doble enlaza exactamente p(n→m) con p(m→n)", () => {
  let state = createBoardScenario({ firstDominoId: "1-6" });
  state = playDomino(state, "1-6");
  const projection = getPortGraphProjection(state);

  assert.deepEqual(
    projection.externalThreads.map((thread) => ({
      dominoId: thread.dominoId,
      from: thread.fromPortId,
      to: thread.toPortId,
    })),
    [{ dominoId: "1-6", from: "p:1->6", to: "p:6->1" }],
  );
  assert.deepEqual(
    projection.openTargets.map((target) => target.endpoint.id).sort(),
    ["p:1->6", "p:6->1"],
  );
});

test("el fixture de doce fichas reconstruye su continuidad mediante hilos y puentes", () => {
  const state = createRepeatedValueChain();
  const projection = getPortGraphProjection(state);
  const start = projection.openTargets.find((target) => target.value === 6);
  const traced = traceProjectedPath(projection, start);

  assert.equal(projection.externalThreads.length, 12);
  assert.equal(projection.internalBridges.length, 11);
  assert.deepEqual(traced.values, CHAIN_VALUES);
  assert.equal(traced.visitedEdgeCount, 23);
  assert.equal(
    projection.openTargets.find((target) => target.value === 5).endpoint.id,
    traced.terminalEndpointId,
  );
  assert.deepEqual(
    projection.openTargets.map(({ value }) => value).sort(),
    [5, 6],
  );
});

test("dos pasos por un mismo valor conservan parejas internas diferentes", () => {
  const projection = getPortGraphProjection(createRepeatedValueChain());
  const bridgesAtOne = projection.internalBridges.filter(
    (bridge) => bridge.value === 1,
  );

  assert.equal(bridgesAtOne.length, 2);
  assert.deepEqual(
    bridgesAtOne.map((bridge) => [bridge.first.id, bridge.second.id]),
    [
      ["p:1->6", "p:1->4"],
      ["p:1->3", "p:1->2"],
    ],
  );
});

test("un chancho ordinario usa dos sockets y no consume puertos ordinarios", () => {
  let state = createBoardScenario({ K: 0, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const projection = getPortGraphProjection(state);
  const hub = projection.doubleHubs[0];

  assert.equal(hub.isSpecial, false);
  assert.deepEqual(
    hub.sockets.map(({ boardPortId }) => boardPortId),
    ["side:a", "side:b"],
  );
  assert.equal(projection.macroNodes[4].ordinaryPorts.length, 6);
  assert.deepEqual(
    projection.openTargets.map(({ endpoint }) => endpoint.kind),
    ["double-socket", "double-socket"],
  );
});

test("un chancho especial expone cuatro sockets y targets individuales", () => {
  let state = createBoardScenario({ K: 7, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  const projection = getPortGraphProjection(state);
  const hub = projection.doubleHubs[0];

  assert.equal(hub.isSpecial, true);
  assert.deepEqual(
    hub.sockets.map(({ boardPortId }) => boardPortId),
    ["main:1", "main:2", "branch:1", "branch:2"],
  );
  assert.equal(new Set(projection.openTargets.map(({ id }) => id)).size, 4);
  assert.ok(projection.openTargets.every((target) => target.value === 4));
  assert.deepEqual(
    projection.openTargets.map(({ actionTarget }) => actionTarget),
    getOpenEndTargets(state).map((target) => ({
      kind: "OPEN_END",
      placementId: target.placementId,
      portId: target.portId,
    })),
  );
});

test("principal, branch:1 y branch:2 conservan continuidad y raíz exactas", () => {
  let state = createBoardScenario({ K: 7, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "3-4", targetAt("placement-1", "main:2"));
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "1-2", targetAt("placement-3", "side:a"));
  state = playDomino(state, "0-4", targetAt("placement-1", "branch:2"));
  const projection = getPortGraphProjection(state);
  const mainBridge = projection.internalBridges.find(
    (bridge) => bridge.connectionId === "connection-1",
  );
  const firstArmBridge = projection.internalBridges.find(
    (bridge) => bridge.connectionId === "connection-2",
  );
  const secondArmBridge = projection.internalBridges.find(
    (bridge) => bridge.connectionId === "connection-4",
  );

  assert.equal(mainBridge.region, "main");
  assert.equal(mainBridge.second.kind, "ordinary-port");
  assert.deepEqual(
    [firstArmBridge.region, firstArmBridge.armIndex, firstArmBridge.originPlacementId],
    ["branch", 1, "placement-1"],
  );
  assert.deepEqual(
    [secondArmBridge.region, secondArmBridge.armIndex, secondArmBridge.originPlacementId],
    ["branch", 2, "placement-1"],
  );
  assert.equal(
    projection.internalBridges.find(
      (bridge) => bridge.connectionId === "connection-3",
    ).structureId,
    "placement-1:branch:1",
  );
});

test("un chancho dentro de una rama sigue siendo ordinario", () => {
  let state = createBoardScenario({ K: 7, firstDominoId: "4-4" });
  state = playDomino(state, "4-4");
  state = playDomino(state, "2-4", targetAt("placement-1", "branch:1"));
  state = playDomino(state, "2-2", targetAt("placement-2", "side:a"));
  const projection = getPortGraphProjection(state);
  const branchHub = projection.doubleHubs.find(
    (hub) => hub.dominoId === "2-2",
  );

  assert.equal(branchHub.isSpecial, false);
  assert.equal(branchHub.doubleRole, "ORDINARY_DOUBLE");
  assert.equal(branchHub.sockets.length, 2);
  assert.equal(branchHub.topology.region, "branch");
});

test("projectPortView comparte la proyección reglamentaria de la ronda", () => {
  const state = createRepeatedValueChain();
  const view = projectPortView(state, state.currentPlayerId);

  assert.equal(view.portGraph.macroNodes.length, 7);
  assert.deepEqual(view.roundStatus.scoreByTeam, state.score.teams);
  assert.equal(view.turn.currentPlayerId, state.currentPlayerId);
});
