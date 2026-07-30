import { readFile } from "node:fs/promises";
const files = ["src/app.js","src/db.js","src/utils.js","src/documents.js","src/exporter.js","src/summary.js","src/address.js","src/version.js","service-worker.js"];
let failed = false;
for (const file of files) {
  const text = await readFile(file, "utf8");
  if (/\bvar\b/.test(text) || /console\.log/.test(text)) { console.error(`${file}：發現不允許的舊式宣告或除錯輸出。`); failed = true; }
  if (text.includes("\t")) { console.error(`${file}：請使用空白字元縮排。`); failed = true; }
}
if (failed) process.exit(1);
console.log("程式碼規範檢查通過。");
