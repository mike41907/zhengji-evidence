import { escapeHtml, rocDateTime, sha256 } from "./utils.js";

const table = rows => `<table>${rows.map(([key, value]) =>
  `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value ?? "")}</td></tr>`).join("")}</table>`;

export function photoCaption(evidence, type, index = 1) {
  const number = evidence.number || "未編號";
  if (type === "發現位置照片") return `圖${index}：證物編號${number}於上址${evidence.locationText || "未填位置"}發現時之情形。`;
  if (type === "秤重照片") {
    const base = `圖${index}：證物編號${number}之${evidence.name || "證物"}${evidence.quantity || ""}${evidence.quantityUnit || ""}，經電子磅秤秤得毛重${evidence.grossWeight || "未填"}${evidence.weightUnit || "公克"}`;
    return evidence.packageWeight !== "" && evidence.packageWeight != null
      ? `${base}，扣除包裝重量${evidence.packageWeight}${evidence.weightUnit || "公克"}後，淨重${evidence.netWeight}${evidence.weightUnit || "公克"}。`
      : `${base}。`;
  }
  if (type === "初驗照片") return `圖${index}：證物編號${number}經${evidence.reagent || "未填試劑"}檢驗，${evidence.testResult || "結果未填"}。`;
  return `圖${index}：證物編號${number}之其他採證照片。`;
}

function heading(title, caseData, draft) {
  return `<header><h1>${escapeHtml(title)}</h1>${draft ? '<div class="watermark">未簽署工作稿</div>' : ""}
    <p>案件名稱：${escapeHtml(caseData.name || "未填")}</p></header>`;
}

export function generateDocument(type, caseData, evidenceList, photos, options = {}) {
  const draft = !options.signed;
  let body = "";
  if (type === "搜索扣押筆錄") {
    body = heading(type, caseData, draft) + table([
      ["案號", caseData.caseNumber], ["案由", caseData.reason], ["執行單位", caseData.unit],
      ["犯罪嫌疑人", caseData.suspect], ["搜索地點", caseData.address],
      ["搜索開始時間", rocDateTime(caseData.searchStart)], ["搜索結束時間", rocDateTime(caseData.searchEnd)],
      ["執行人員", caseData.executors], ["在場人員", caseData.presentPeople]
    ]) + `<h2>扣押物品及查獲情形</h2>${evidenceTable(evidenceList)}${signatureArea(options)}`;
  } else if (type === "毒品初步檢驗紀錄表") {
    body = evidenceList.map(item => heading(type, caseData, draft) + table([
      ["案號", caseData.caseNumber], ["犯罪嫌疑人", caseData.suspect],
      ["查獲日期時間", rocDateTime(item.foundAt)], ["查獲地點", `${caseData.address || ""}${item.locationText || ""}`],
      ["證物編號", item.number], ["證物名稱", item.name], ["外觀", item.appearance], ["顏色", item.color],
      ["包裝方式", item.packaging], ["數量", `${item.quantity || ""}${item.quantityUnit || ""}`],
      ["毛重", `${item.grossWeight || ""}${item.weightUnit || ""}`], ["包裝重量", `${item.packageWeight || ""}${item.weightUnit || ""}`],
      ["淨重", `${item.netWeight || ""}${item.weightUnit || ""}`], ["初驗試劑", item.reagent],
      ["初驗結果", item.testResult], ["反應情形", item.reaction],
      ["初驗時間", rocDateTime(item.testAt)], ["初驗人員", caseData.tester]
    ]) + signatureArea(options)).join('<div class="page-break"></div>');
  } else if (type === "證物照片紀錄") {
    let sequence = 0;
    const cards = photos.sort((a, b) => (a.order || 0) - (b.order || 0)).map(photo => {
      const evidence = evidenceList.find(item => item.id === photo.evidenceId) || {};
      sequence += 1;
      const source = photo.preview || photo.original;
      return `<figure><img src="${source instanceof Blob ? URL.createObjectURL(source) : source}" alt="證物照片">
        <figcaption>${escapeHtml(photo.caption || photoCaption(evidence, photo.type, sequence))}<br>拍攝時間：${rocDateTime(photo.finalAt)}</figcaption></figure>`;
    }).join("");
    body = heading(type, caseData, draft) + `<div class="photo-grid">${cards || "<p>尚無照片。</p>"}</div>`;
  } else {
    body = heading("扣押物品清冊", caseData, draft) + evidenceTable(evidenceList);
  }
  return `<article class="document">${body}<footer>文件版本：${escapeHtml(options.version || "第一版")}</footer></article>`;
}

function evidenceTable(items) {
  return `<table><thead><tr><th>項次</th><th>證物編號</th><th>品名</th><th>外觀</th><th>顏色</th><th>包裝</th><th>數量</th><th>毛重</th><th>淨重</th><th>初驗結果</th></tr></thead><tbody>
    ${items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.number)}</td><td>${escapeHtml(item.name)}</td>
    <td>${escapeHtml(item.appearance)}</td><td>${escapeHtml(item.color)}</td><td>${escapeHtml(item.packaging)}</td>
    <td>${escapeHtml(`${item.quantity || ""}${item.quantityUnit || ""}`)}</td><td>${escapeHtml(`${item.grossWeight || ""}${item.weightUnit || ""}`)}</td>
    <td>${escapeHtml(`${item.netWeight || ""}${item.weightUnit || ""}`)}</td><td>${escapeHtml(item.testResult)}</td></tr>`).join("")}</tbody></table>`;
}

function signatureArea(options) {
  return `<section class="signature-box"><h2>簽名欄位</h2>${options.signature
    ? `<img src="${options.signature}" alt="簽名"><p>${escapeHtml(options.signerName)}（${escapeHtml(options.signerRole)}）</p><p>簽署時間：${rocDateTime(options.signedAt)}</p>`
    : "<div class=\"signature-line\">簽署人簽名：</div>"}</section>`;
}

export const wrapDocument = content => `<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>證跡文件</title>
<style>body{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;color:#111;margin:24mm}h1{text-align:center}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #333;padding:8px;text-align:left}.watermark{color:#b42318;border:3px solid #b42318;padding:8px;text-align:center;font-weight:bold}.photo-grid{display:grid;grid-template-columns:1fr;gap:18px}figure{break-inside:avoid;margin:0;border:1px solid #555;padding:10px}figure img{width:100%;max-height:280px;object-fit:contain}.signature-box img{max-width:260px;max-height:120px}.signature-line{height:100px;border-bottom:1px solid #333}.page-break{break-after:page}footer{margin-top:20px;font-size:12px}@media print{body{margin:12mm}.document{break-after:page}}</style></head><body>${content}</body></html>`;

export async function documentHash(content) {
  return sha256(content);
}
