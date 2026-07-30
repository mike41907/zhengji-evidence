import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const root = process.cwd();
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8", ".webmanifest":"application/manifest+json", ".svg":"image/svg+xml" };
createServer(async (request, response) => {
  try {
    const raw = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const relative = raw === "/" ? "index.html" : raw.replace(/^\/+/, "");
    const file = normalize(join(root, relative));
    if (!file.startsWith(root)) throw new Error("路徑不允許");
    const info = await stat(file);
    const target = info.isDirectory() ? join(file, "index.html") : file;
    response.writeHead(200, { "Content-Type": mime[extname(target)] || "application/octet-stream", "Cache-Control":"no-store" });
    response.end(await readFile(target));
  } catch { response.writeHead(404, { "Content-Type":"text/plain; charset=utf-8" }); response.end("找不到檔案"); }
}).listen(4173, "0.0.0.0", () => console.log("證跡已啟動：http://localhost:4173"));
