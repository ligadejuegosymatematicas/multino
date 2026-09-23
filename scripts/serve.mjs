import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_NAME, createWebManifest } from "../src/js/config/AppConfig.js";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requestedPort = Number.parseInt(process.env.PORT ?? "4173", 10);
const port = Number.isInteger(requestedPort) ? requestedPort : 4173;

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const absolutePath = resolve(projectRoot, relativePath);

  if (absolutePath !== projectRoot && !absolutePath.startsWith(`${projectRoot}${sep}`)) {
    return null;
  }

  return absolutePath;
}

const server = createServer(async (request, response) => {
  const filePath = resolveRequestPath(request.url ?? "/");

  if (!filePath) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  if (filePath === resolve(projectRoot, "manifest.webmanifest")) {
    response.writeHead(200, {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    response.end(`${JSON.stringify(createWebManifest(), null, 2)}\n`);
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      throw new Error("Not a file");
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extname(filePath)) ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`${APP_NAME} disponible en http://127.0.0.1:${port}`);
});

process.on("SIGINT", () => {
  server.close(() => process.exit(0));
});
