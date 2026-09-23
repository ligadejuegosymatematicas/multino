import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  APP_NAME,
  createWebManifest,
} from "../../src/js/config/AppConfig.js";

const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const main = await readFile(new URL("../../src/js/main.js", import.meta.url), "utf8");

test("la marca pública usa los assets oficiales y una configuración única", () => {
  assert.equal(APP_NAME, "MULTINÓ");
  assert.equal(createWebManifest().name, APP_NAME);
  assert.match(html, /MULTINO_logo_oficial_original_transparente\.svg/);
  assert.match(html, /MULTINO_isotipo_oficial_original_transparente\.svg/);
  assert.match(html, /data-app-name/);
  assert.match(main, /element\.textContent = APP_NAME/);
  assert.doesNotMatch(html, /brand-mark/);
  assert.doesNotMatch(html, /Jugar MULTINÓ/);
  assert.match(html, /Elige cómo jugar/);
});

test("crear sala no solicita un nombre o código y el lobby ofrece ambas copias", () => {
  const createBlock = html.match(
    /<div class="online-create-block">([\s\S]*?)<\/div>/,
  )?.[1] ?? "";
  assert.match(createBlock, /Crear sala/);
  assert.doesNotMatch(createBlock, /<input/);
  assert.doesNotMatch(createBlock, /nombre de sala/i);
  assert.match(html, /id="copy-room-code-action"/);
  assert.match(html, /id="copy-room-link-action"/);
  assert.match(main, /navigator\.clipboard\.writeText\(roomCode\)/);
  assert.match(main, /onlineRoomCode\.value = session\.pendingRoomCode/);
});
