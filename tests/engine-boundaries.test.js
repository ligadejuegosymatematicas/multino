import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const gameDirectory = new URL("../src/js/game/", import.meta.url);

async function listJavaScriptFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryUrl = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directoryUrl);
      return entry.isDirectory()
        ? listJavaScriptFiles(entryUrl)
        : entry.name.endsWith(".js")
          ? [entryUrl]
          : [];
    }),
  );

  return nested.flat();
}

test("todos los módulos del motor se importan sin navegador", async () => {
  const files = await listJavaScriptFiles(gameDirectory);

  await assert.doesNotReject(() => Promise.all(files.map((file) => import(file.href))));
});

test("el motor no contiene dependencias de DOM ni coordenadas visuales", async () => {
  const files = await listJavaScriptFiles(gameDirectory);
  const forbiddenPatterns = [
    /\bdocument\b/,
    /\bwindow\b/,
    /\bHTMLElement\b/,
    /\bquerySelector\b/,
    /\bgetElementById\b/,
    /\bclientX\b/,
    /\bclientY\b/,
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    for (const pattern of forbiddenPatterns) {
      assert.equal(pattern.test(source), false, `${file.pathname} contiene ${pattern}`);
    }
  }
});

