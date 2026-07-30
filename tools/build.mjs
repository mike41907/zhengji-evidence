import { cp, mkdir, rm, writeFile } from "node:fs/promises";
const output = "dist";
await rm(output, { recursive:true, force:true });
await mkdir(output, { recursive:true });
for (const path of ["index.html","manifest.webmanifest","service-worker.js","icons","src","vendor","docs","README.md"]) await cp(path, `${output}/${path}`, { recursive:true });
await mkdir(`${output}/server`, { recursive:true });
await writeFile(`${output}/server/index.js`, `export default {
  async fetch(request, environment) {
    if (environment.ASSETS) return environment.ASSETS.fetch(request);
    return new Response("網站資源尚未完成部署。", { status: 503 });
  }
};
`, "utf8");
console.log("正式版本已建立於 dist 資料夾。");
