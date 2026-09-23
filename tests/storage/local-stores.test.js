import assert from "node:assert/strict";
import test from "node:test";

import {
  LocalMatchHistoryStore,
  LocalOnlineRoomStore,
  LocalProfileStore,
} from "../../src/js/storage/LocalStores.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

test("el perfil local conserva el nick sin crear cuentas", () => {
  const store = new LocalProfileStore(new MemoryStorage());
  assert.deepEqual(store.load(), { nick: "" });
  store.save({ nick: "  Henry  " });
  assert.deepEqual(store.load(), { nick: "Henry" });
});

test("el historial local conserva registros de replay y limita la lista", () => {
  const store = new LocalMatchHistoryStore(new MemoryStorage());
  for (let index = 0; index < 55; index += 1) {
    store.save({ matchId: `match-${index}`, moves: [{ sequence: index }] });
  }
  assert.equal(store.list().length, 50);
  assert.equal(store.list()[0].matchId, "match-54");
  assert.deepEqual(store.list()[0].moves, [{ sequence: 54 }]);
});

test("la sala online activa sobrevive al cierre de la aplicación", () => {
  const storage = new MemoryStorage();
  const store = new LocalOnlineRoomStore(storage);
  assert.deepEqual(store.load(), { roomCode: "" });
  store.save({ roomCode: " ab12c " });
  assert.deepEqual(store.load(), { roomCode: "AB12C" });
  store.clear();
  assert.deepEqual(store.load(), { roomCode: "" });
});
