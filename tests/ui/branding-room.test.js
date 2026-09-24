import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import test from "node:test";
import { getBrandScale } from "../../src/js/ui/BrandPresentation.js";

import {
  APP_NAME,
  createWebManifest,
} from "../../src/js/config/AppConfig.js";

const html = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const main = await readFile(new URL("../../src/js/main.js", import.meta.url), "utf8");
const theme = await readFile(new URL("../../src/css/theme.css", import.meta.url), "utf8");

test("la marca pública usa los assets oficiales y una configuración única", () => {
  assert.equal(APP_NAME, "MULTINÓ");
  assert.equal(createWebManifest().name, APP_NAME);
  assert.match(html, /multino_logo_vector_v8\.svg/);
  assert.match(html, /multino_isotipo_original_192x192\.png/);
  assert.match(html, /data-app-name/);
  assert.match(main, /element\.textContent = APP_NAME/);
  assert.doesNotMatch(html, /brand-mark/);
  assert.doesNotMatch(html, /Jugar MULTINÓ/);
  assert.match(html, /Elige cómo jugar/);
  assert.match(html, /Dominó, estrategia y múltiplos\./);
  assert.doesNotMatch(html, /Órbita|Vector/);
  assert.match(theme, /\.team-badge\[data-team-id="B"\]/);
  assert.match(theme, /--team-a:\s*#a98cff/);
  assert.match(theme, /--team-b:\s*#ff9278/);
  assert.doesNotMatch(theme, /--team-a:\s*var\(--playable\)/);
  assert.doesNotMatch(theme, /--team-b:\s*var\(--scoring\)/);
});

test("hero, panel y compact usan encajes propios sin modificar el maestro v8", async () => {
  const master = await readFile(new URL("../../assets/brand/multino_logo_vector_v8.svg", import.meta.url));
  assert.equal(createHash("sha256").update(master).digest("hex"),
    "30a8a9b7b3df81f7c3fab83997ad49fc0057a818a1a683d2d2f3604ccdc03cc8");
  assert.equal((html.match(/brand-showcase brand-hero/g) ?? []).length, 1);
  assert.equal((html.match(/brand-showcase brand-panel/g) ?? []).length, 2);
  assert.match(html, /brand-lockup brand-compact/);
  const css = await readFile(new URL("../../src/css/components.css", import.meta.url), "utf8");
  assert.match(css, /aspect-ratio: 1000 \/ 953/);
  assert.doesNotMatch(css.match(/\.brand-logo \{[^}]*\}/)?.[0] ?? "", /max-height/);
  assert.match(css, /transform: scale\(var\(--brand-scale, 0\)\)/);
  assert.equal(getBrandScale(335), 0.335);
  assert.equal(getBrandScale(160), 0.16);
  assert.equal(getBrandScale(0), 0);
  assert.equal(getBrandScale(NaN), 0);
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
