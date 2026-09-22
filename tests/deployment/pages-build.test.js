import assert from "node:assert/strict";
import { access, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildPages } from "../../scripts/build-pages.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const dist = resolve(root, "dist");

test("el build de Pages publica solo frontend y configuración pública", async () => {
  await buildPages();
  await access(resolve(dist, "index.html"));
  await access(resolve(dist, "src/js/main.js"));
  await access(resolve(dist, "runtime-config.js"));
  await assert.rejects(access(resolve(dist, "supabase")));
  await assert.rejects(access(resolve(dist, ".git")));
  const html = await readFile(resolve(dist, "index.html"), "utf8");
  const runtime = await readFile(resolve(dist, "runtime-config.js"), "utf8");
  assert.match(html, /\.\/src\/js\/main\.js/);
  assert.match(html, /\.\/runtime-config\.js/);
  assert.match(html, /Jugar local/i);
  assert.match(html, /Jugar online/i);
  assert.match(runtime, /kefdfpalennsnnfnjwpc\.supabase\.co/);
  assert.match(runtime, /sb_publishable_/);
  assert.doesNotMatch(runtime, /SUPABASE_SERVICE_ROLE_KEY/);
  await rm(dist, { recursive: true, force: true });
});

test("el workflow usa el artefacto dist y solo variables públicas", async () => {
  const workflow = await readFile(
    new URL("../../.github/workflows/pages.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /path: dist/);
  assert.match(workflow, /vars\.SUPABASE_URL/);
  assert.match(workflow, /vars\.SUPABASE_PUBLIC_KEY/);
  assert.doesNotMatch(workflow, /SERVICE_ROLE/);
});
