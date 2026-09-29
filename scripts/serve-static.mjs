import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const directory = resolve(process.argv[2] ?? "storybook-static");
const port = Number(process.argv[3] ?? 6006);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
};

createServer((request, response) => {
  const rawPath = new URL(request.url ?? "/", `http://127.0.0.1:${port}`).pathname;
  const relativePath = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "");
  const normalized = normalize(relativePath);
  const candidate = join(directory, normalized);

  if (!candidate.startsWith(directory) || !existsSync(candidate) || !statSync(candidate).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "Content-Type": contentTypes[extname(candidate)] ?? "application/octet-stream",
    "Cache-Control": "no-store",
  });
  createReadStream(candidate).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving ${directory} at http://127.0.0.1:${port}`);
});
