import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
const output = "dist";
await rm(output, { recursive:true, force:true });
await mkdir(output, { recursive:true });
for (const path of [".openai","index.html","manifest.webmanifest","service-worker.js","icons","src","vendor","docs","README.md","CHANGELOG.md"]) await cp(path, `${output}/${path}`, { recursive:true });
await mkdir(`${output}/server`, { recursive:true });
const publicFiles = {
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/manifest.webmanifest": ["manifest.webmanifest", "application/manifest+json; charset=utf-8"],
  "/service-worker.js": ["service-worker.js", "text/javascript; charset=utf-8"],
  "/src/styles.css": ["src/styles.css", "text/css; charset=utf-8"],
  "/src/app.js": ["src/app.js", "text/javascript; charset=utf-8"],
  "/src/db.js": ["src/db.js", "text/javascript; charset=utf-8"],
  "/src/utils.js": ["src/utils.js", "text/javascript; charset=utf-8"],
  "/src/documents.js": ["src/documents.js", "text/javascript; charset=utf-8"],
  "/src/exporter.js": ["src/exporter.js", "text/javascript; charset=utf-8"],
  "/src/summary.js": ["src/summary.js", "text/javascript; charset=utf-8"],
  "/src/address.js": ["src/address.js", "text/javascript; charset=utf-8"],
  "/src/version.js": ["src/version.js", "text/javascript; charset=utf-8"],
  "/vendor/jszip.min.js": ["vendor/jszip.min.js", "text/javascript; charset=utf-8"],
  "/icons/icon.svg": ["icons/icon.svg", "image/svg+xml"],
  "/icons/icon-192.png": ["icons/icon-192.png", "image/png"],
  "/icons/icon-512.png": ["icons/icon-512.png", "image/png"],
  "/icons/apple-touch-icon.png": ["icons/apple-touch-icon.png", "image/png"],
  "/apple-touch-icon.png": ["icons/apple-touch-icon.png", "image/png"],
  "/apple-touch-icon-precomposed.png": ["icons/apple-touch-icon.png", "image/png"],
  "/favicon.ico": ["icons/icon-192.png", "image/png"]
};
const bundled = {};
for (const [route, [file, type]] of Object.entries(publicFiles)) {
  bundled[route] = { type, body: (await readFile(file)).toString("base64") };
}
await writeFile(`${output}/server/index.js`, `const files = ${JSON.stringify(bundled)};
function decode(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = files[path] || (request.headers.get("accept")?.includes("text/html") ? files["/index.html"] : null);
    if (!file) return new Response("找不到檔案", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    const cacheControl = path === "/service-worker.js" || path === "/index.html"
      ? "no-cache"
      : "public, max-age=31536000, immutable";
    return new Response(decode(file.body), {
      status: 200,
      headers: {
        "content-type": file.type,
        "cache-control": cacheControl,
        "x-content-type-options": "nosniff"
      }
    });
  }
};
`, "utf8");
console.log("正式版本已建立於 dist 資料夾。");
