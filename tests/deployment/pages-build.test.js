import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { buildPages } from "../../scripts/build-pages.mjs";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const dist = resolve(root, "dist");

function sha256(content) {
  return createHash("sha256").update(content).digest("hex").toUpperCase();
}

test("el build de Pages publica solo frontend y configuración pública", async () => {
  await buildPages();
  await access(resolve(dist, "index.html"));
  await access(resolve(dist, "src/js/main.js"));
  await access(resolve(dist, "runtime-config.js"));
  await access(resolve(dist, "manifest.webmanifest"));
  await access(resolve(dist, "assets/brand/multino_logo_vector_v8.svg"));
  await access(resolve(dist, "assets/brand/multino_isotipo_original_512x512.png"));
  await assert.rejects(access(resolve(dist, "supabase")));
  await assert.rejects(access(resolve(dist, ".git")));
  const html = await readFile(resolve(dist, "index.html"), "utf8");
  const runtime = await readFile(resolve(dist, "runtime-config.js"), "utf8");
  const manifest = JSON.parse(
    await readFile(resolve(dist, "manifest.webmanifest"), "utf8"),
  );
  const sourceLogo = await readFile(
    resolve(root, "assets/brand/multino_logo_vector_v8.svg"),
  );
  const builtLogo = await readFile(
    resolve(dist, "assets/brand/multino_logo_vector_v8.svg"),
  );
  assert.match(html, /\.\/src\/js\/main\.js/);
  assert.match(html, /\.\/runtime-config\.js/);
  assert.match(html, /Jugar local/i);
  assert.match(html, /Jugar online/i);
  assert.match(html, /multino_logo_vector_v8\.svg/);
  assert.equal(manifest.name, "MULTINÓ");
  assert.equal(manifest.icons.length, 2);
  assert.equal(
    sha256(sourceLogo),
    "30A8A9B7B3DF81F7C3FAB83997AD49FC0057A818A1A683D2D2F3604CCDC03CC8",
  );
  assert.deepEqual(builtLogo, sourceLogo);
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
  assert.match(workflow, /enablement:\s*true/);
  assert.match(workflow, /vars\.SUPABASE_URL/);
  assert.match(workflow, /vars\.SUPABASE_PUBLIC_KEY/);
  assert.doesNotMatch(workflow, /SERVICE_ROLE/);
});
