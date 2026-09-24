import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const main = await readFile(new URL("../../src/js/main.js", import.meta.url), "utf8");

test("public copy is brief, keeps mathematical vocabulary and removes redundant filler", () => {
  for (const text of [
    "Dominó, estrategia y múltiplos de 5.", "Configura la ronda y elige cómo verla.",
    "En Ramificado, el primer doble jugado es el único que puede recibir hasta cuatro conexiones.",
    "4 jugadores · compañeros de equipo frente a frente.", "Empezar partida",
    "Se puntúa con múltiplos de 5.", "Nombre de jugador",
    "Crea una sala privada o únete con un código.",
  ]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html + main, /Salas privadas online disponibles|Tu nick|Escribe tu nick|El primer chancho jugado|Crear una sala privada<\/span>/);
  assert.match(html, /↗<\/b> conexiones/);
  assert.match(html, /×<\/b> suma/);
  assert.match(html, /▣<\/b> salieron/);
});

test("initial view order matches gameplay and keeps Traditional default; seats remain explicit", () => {
  const modes = [...html.matchAll(/name="initial-view-mode" value="([^"]+)"/g)].map(match => match[1]);
  const tabs = [...html.matchAll(/data-view-mode="([^"]+)" aria-pressed/g)].map(match => match[1]);
  assert.deepEqual(modes, ["traditional", "ports", "graph"]);
  assert.deepEqual(modes, tabs);
  assert.match(html, /value="traditional" checked/);
  for (let i = 1; i <= 4; i++) assert.ok(html.includes(`Asiento ${i} · Equipo ${i % 2 ? "A" : "B"}`));
  assert.doesNotMatch(html, /<select[^>]*(scoring|divisor)/);
});
