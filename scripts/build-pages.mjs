import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createWebManifest } from "../src/js/config/AppConfig.js";

await import("../runtime-config.js");

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const outputRoot = resolve(projectRoot, "dist");

function publicRuntimeConfig() {
  const fallback = globalThis.MULTINO_RUNTIME_CONFIG ?? {};
  const supabaseUrl = process.env.SUPABASE_URL?.trim() ||
    String(fallback.supabaseUrl ?? "").trim();
  const supabasePublicKey = process.env.SUPABASE_PUBLIC_KEY?.trim() ||
    String(fallback.supabasePublicKey ?? "").trim();
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY nunca puede entrar al build público.");
  }
  if (
    supabaseUrl && !/^https:\/\/.+\.supabase\.co$/.test(supabaseUrl)
  ) {
    throw new Error("SUPABASE_URL pública inválida.");
  }
  if (supabasePublicKey && !supabasePublicKey.startsWith("sb_publishable_")) {
    throw new Error("El build público solo acepta una publishable key.");
  }
  return `globalThis.MULTINO_RUNTIME_CONFIG = Object.freeze(${JSON.stringify({
    supabaseUrl,
    supabasePublicKey,
  }, null, 2)});\n`;
}

export async function buildPages() {
  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(outputRoot, { recursive: true });
  await cp(resolve(projectRoot, "index.html"), resolve(outputRoot, "index.html"));
  await cp(resolve(projectRoot, "src"), resolve(outputRoot, "src"), {
    recursive: true,
  });
  await cp(resolve(projectRoot, "assets"), resolve(outputRoot, "assets"), {
    recursive: true,
  });
  await writeFile(
    resolve(outputRoot, "manifest.webmanifest"),
    `${JSON.stringify(createWebManifest(), null, 2)}\n`,
  );
  await writeFile(resolve(outputRoot, "runtime-config.js"), publicRuntimeConfig());
  await writeFile(resolve(outputRoot, ".nojekyll"), "");
  await cp(resolve(outputRoot, "index.html"), resolve(outputRoot, "404.html"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildPages();
  console.log(`MULTINÓ preparado en ${outputRoot}`);
}
