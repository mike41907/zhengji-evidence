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
    body = searchSeizureRecord(caseData, evidenceList, options, draft);
  } else if (type === "毒品初步檢驗紀錄表") {
    const drugEvidence = evidenceList.filter(item => (item.evidenceCategory || "毒品") === "毒品");
    body = drugEvidence.map(item => heading(type, caseData, draft) + table([
      ["犯罪嫌疑人", caseData.suspect],
      ["查獲日期時間", rocDateTime(item.foundAt)], ["查獲地點", `${caseData.address || ""}${item.locationText || ""}`],
      ["證物編號", item.number], ["證物名稱", item.name], ["外觀", item.appearance], ["顏色", item.color],
      ["包裝方式", item.packaging], ["數量", `${item.quantity || ""}${item.quantityUnit || ""}`],
      ["毛重", `${item.grossWeight || ""}${item.weightUnit || ""}`], ["包裝重量", `${item.packageWeight || ""}${item.weightUnit || ""}`],
      ["淨重", `${item.netWeight || ""}${item.weightUnit || ""}`], ["初驗試劑", item.reagent],
      ["初驗結果", item.testResult], ["反應情形", item.reaction],
      ["初驗時間", rocDateTime(item.testAt)], ["初驗人員", caseData.tester]
    ]) + signatureArea(options)).join('<div class="page-break"></div>') || heading(type, caseData, draft) + "<p>本案件尚無毒品類證物。</p>";
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
    body = seizureInventory(caseData, evidenceList, draft);
  }
  if (type === "搜索扣押筆錄" || type === "扣押物品目錄表" || type === "扣押物品清冊") return body;
  return `<article class="document">${body}<footer>文件版本：${escapeHtml(options.version || "第一版")}</footer></article>`;
}

function evidenceTable(items) {
  return `<table><thead><tr><th>項次</th><th>證物編號</th><th>品名</th><th>外觀</th><th>顏色</th><th>包裝</th><th>數量</th><th>毛重</th><th>淨重</th><th>初驗結果</th></tr></thead><tbody>
    ${items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.number)}</td><td>${escapeHtml(item.name || item.evidenceCategory)}</td>
    <td>${escapeHtml(item.appearance)}</td><td>${escapeHtml(item.color)}</td><td>${escapeHtml(item.packaging)}</td>
    <td>${escapeHtml(`${item.quantity || ""}${item.quantityUnit || ""}`)}</td><td>${escapeHtml(`${item.grossWeight || ""}${item.weightUnit || ""}`)}</td>
    <td>${escapeHtml(`${item.netWeight || ""}${item.weightUnit || ""}`)}</td><td>${escapeHtml(item.testResult)}</td></tr>`).join("")}</tbody></table>`;
}

const mark = checked => checked ? "☑" : "☐";
const line = value => escapeHtml(value || "　　　　　　　　　");

function legalBasisOptions(caseData) {
  const selected = caseData.searchLegalBasis || "";
  return [
    ["出示搜索票", `出示搜索票（${caseData.warrantNumber ? `字號：${escapeHtml(caseData.warrantNumber)}` : "搜索票字號留存於卷內"}）`],
    ["附帶搜索", "依刑事訴訟法第一百三十條執行附帶搜索。"],
    ["逕行搜索", "依刑事訴訟法第一百三十一條第一項執行逕行搜索。"],
    ["緊急搜索", "依刑事訴訟法第一百三十一條第二項執行緊急搜索。"],
    ["同意搜索", "依刑事訴訟法第一百三十一條之一，經受搜索人同意執行搜索。"],
    ["其他", "其他依法得執行搜索之依據。"]
  ].map(([value, label]) => `<p>${mark(selected === value)} ${label}</p>`).join("");
}

function searchSeizureRecord(caseData, evidenceList, options, draft) {
  const hasSeizure = evidenceList.length > 0;
  const signer = options.signature
    ? `<img src="${options.signature}" alt="受執行人簽名"><span>${escapeHtml(options.signerName || caseData.suspect)}</span>`
    : "（　　　　　　　　　　　　　　）";
  const pageOne = `<article class="document search-record-page">
    <header class="search-record-title"><h1>附錄一、搜索筆錄範本</h1></header>
    <div class="search-record-agency"><strong>（${escapeHtml(caseData.agencyName || caseData.unit || "執行機關")}）</strong>
      <span>${mark(true)} 搜索筆錄<br>${mark(hasSeizure)} 扣押筆錄</span></div>
    ${draft ? '<div class="watermark">未簽署工作稿</div>' : ""}
    <table class="search-record-table">
      <tbody>
        <tr><th>執行時間</th><td>自 ${line(rocDateTime(caseData.searchStart))} 起<br>至 ${line(rocDateTime(caseData.searchEnd))} 止</td></tr>
        <tr><th>執行處所</th><td>${line(caseData.address)}</td></tr>
        <tr><th rowspan="7">受執行人</th><td>身分　${["受搜索人","扣押物所有人","扣押物持有人","扣押物保管人"].map(role => `${mark(caseData.suspectRole === role)}${role}`).join("　")}</td></tr>
        <tr><td>姓名　${line(caseData.suspect)}</td></tr>
        <tr><td>性別　${line(caseData.suspectGender)}</td></tr>
        <tr><td>出生年月日　${line(caseData.suspectBirthDate)}</td></tr>
        <tr><td>身分證統一編號　${line(caseData.suspectId)}</td></tr>
        <tr><td>住居所　${line(caseData.suspectResidence || caseData.suspectRegisteredAddress)}</td></tr>
        <tr><td>是否在場　${line(caseData.suspectPresent || "是")}</td></tr>
        <tr><th>執行之依據</th><td class="legal-basis">${legalBasisOptions(caseData)}</td></tr>
      </tbody>
    </table>
  </article>`;
  const pageTwo = `<article class="document search-record-page">
    <table class="search-record-table page-two">
      <tbody>
        <tr><th>執行時告知事項</th><td>
          <p>執行理由：為搜索本案證物品。</p>
          <p>執行對象：${mark(true)}被告　${mark(false)}犯罪嫌疑人　${mark(false)}第三人</p>
          <p>執行範圍：${mark(true)}處所　${mark(false)}身體　${mark(false)}物件　${mark(false)}電磁紀錄</p>
          <p>應扣押之物：本案物件</p>
        </td></tr>
        <tr><th>執行經過情形</th><td class="procedure-checks">
          <p>${mark(false)} 執行人員有出示證件表明身分。</p>
          <p>${mark(false)} 搜索婦女之身體，有命婦女行之；不能由婦女行之者，已記明原因。</p>
          <p>${mark(false)} 執行搜索時，已保持名譽並避免不必要之干擾。</p>
          <p>${mark(false)} 有開啟鎖閉封緘或其他必要之處分時，已注意現場安全及比例原則。</p>
          <p>${mark(false)} 搜索有人住居或看守之處所，已請住居人、看守人或其他適當之人在場。</p>
          <p>${mark(false)} 對於政府機關、公務員或軍人持有或保管之文書及物件，依法辦理。</p>
          <p>${mark(false)} 其他：________________________________________________</p>
        </td></tr>
        <tr><th>結果</th><td>
          <p>經搜索未發現應行扣押物，並付與無應扣押之物證明書。</p>
          <p>受搜索人簽名捺印：${signer}</p>
          <p>${mark(hasSeizure)} 發現應行扣押物，已扣押並付與扣押物收據、搜索扣押物品目錄表。</p>
          <p>受執行人簽名捺印：${signer}</p>
          <p>${mark(false)} 其他：________________________________________________</p>
        </td></tr>
      </tbody>
    </table>
  </article>`;
  const pageThree = `<article class="document search-record-page">
    <div class="search-record-final">
      <p>上開筆錄經受搜索人或受扣押人及在場人親自閱覽或告以要旨確認無誤後，始命其簽名捺印：</p>
      <p class="search-record-signer">受執行人：${options.signature ? signer : line(caseData.suspect)}</p>
      <p>在場人：${line(caseData.presentPeople)}</p>
      <p>住所：${line(caseData.suspectResidence || caseData.address)}</p>
      <p>執行人：${line(caseData.executors)}</p>
      <p>紀錄人：${line(caseData.recorder)}</p>
      <p>中華民國　${line(rocDateTime(caseData.searchEnd || caseData.searchStart))}</p>
    </div>
    <ol class="search-record-notes">
      <li>本筆錄可供執行搜索扣押或未經搜索之單純扣押之用，請依實際執行情形填寫。</li>
      <li>經受搜索人出於自願性同意搜索者，應請受搜索人簽名捺印。</li>
      <li>執行結果發現無應扣押之物證明書或扣押物證據，應請受執行人簽名捺印。</li>
    </ol>
  </article>`;
  return `${pageOne}<div class="page-break"></div>${pageTwo}<div class="page-break"></div>${pageThree}`;
}

function inventoryItemName(item) {
  const category = item.evidenceCategory || "毒品";
  const details = [];
  if (category === "毒品") {
    details.push(item.drugType || item.name || "疑似毒品");
    if (item.appearance) details.push(item.appearance);
    if (item.packaging) details.push(item.packaging);
  } else if (category === "手機") {
    details.push(item.name || "手機");
    if (item.brand || item.model) details.push([item.brand, item.model].filter(Boolean).join(" "));
    if (item.imei) details.push(`IMEI：${item.imei}`);
  } else if (category === "電子磅秤") {
    details.push(item.name || "電子磅秤");
    if (item.brand || item.model) details.push([item.brand, item.model].filter(Boolean).join(" "));
    if (item.scaleResidue) details.push(`秤面：${item.scaleResidue}`);
  } else if (category === "毒品施用器具") {
    details.push(item.utensilType || item.name || "毒品施用器具");
    if (item.material) details.push(item.material);
    if (item.residue) details.push(`殘留：${item.residue}`);
  } else if (category === "現金") {
    details.push(item.name || "現金");
    if (item.denomination && item.billCount) details.push(`${item.denomination}元×${item.billCount}張`);
    if (item.cashTotal) details.push(`合計${item.cashTotal}元`);
  } else {
    details.push(item.name || category);
    if (item.material) details.push(item.material);
    if (item.residue) details.push(`殘留：${item.residue}`);
    if (item.categoryNote) details.push(item.categoryNote);
  }
  return details.filter(Boolean).join("\n");
}

function seizureInventory(caseData, items, draft) {
  const minimumRows = 11;
  const rows = Array.from({ length: Math.max(minimumRows, items.length) }, (_, index) => {
    const item = items[index];
    if (!item) return `<tr class="inventory-empty"><td>${index + 1}</td><td></td><td></td><td></td><td></td><td></td></tr>`;
    const isCash = item.evidenceCategory === "現金";
    const unit = isCash ? "張" : item.quantityUnit || "件";
    const quantity = isCash ? item.billCount || "" : item.quantity || "";
    return `<tr><td>${index + 1}</td><td class="inventory-name">${escapeHtml(inventoryItemName(item)).replaceAll("\n", "<br>")}</td>
      <td>${escapeHtml(unit)}</td><td>${escapeHtml(quantity)}</td><td class="inventory-signature"></td>
      <td>${escapeHtml(item.notes || "")}</td></tr>`;
  }).join("");
  return `<article class="document seizure-inventory">
    <header><h1>${escapeHtml(caseData.agencyName || caseData.unit || "執行機關")}扣押物品目錄表</h1>${draft ? '<div class="watermark">未簽署工作稿</div>' : ""}</header>
    <table class="inventory-table">
      <colgroup><col style="width:8%"><col style="width:35%"><col style="width:10%"><col style="width:10%"><col style="width:27%"><col style="width:10%"></colgroup>
      <thead><tr><th>編號</th><th>品名</th><th>單位</th><th>數量</th><th>所有人／持有<br>人／保管人</th><th>備考</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="inventory-footnote">（可視實際需要增列）</p>
  </article>`;
}

function signatureArea(options) {
  return `<section class="signature-box"><h2>簽名欄位</h2>${options.signature
    ? `<img src="${options.signature}" alt="簽名"><p>${escapeHtml(options.signerName)}（${escapeHtml(options.signerRole)}）</p><p>簽署時間：${rocDateTime(options.signedAt)}</p>`
    : "<div class=\"signature-line\">簽署人簽名：</div>"}</section>`;
}

export const wrapDocument = content => `<!doctype html><html lang="zh-Hant"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>證跡文件</title>
<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;color:#111;margin:0;background:#fff}.document{width:100%;min-height:273mm;padding:6mm;background:#fff;break-after:page}.document:last-child{break-after:auto}h1{text-align:center}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #333;padding:8px;text-align:left}.watermark{color:#b42318;border:3px solid #b42318;padding:8px;text-align:center;font-weight:bold}.photo-grid{display:grid;grid-template-columns:1fr;gap:18px}figure{break-inside:avoid;margin:0;border:1px solid #555;padding:10px}figure img{width:100%;max-height:280px;object-fit:contain}.signature-box img{max-width:260px;max-height:120px}.signature-line{height:100px;border-bottom:1px solid #333}.page-break{break-after:page;height:0}footer{margin-top:20px;font-size:12px}.seizure-inventory{font-family:"DFKai-SB","標楷體","BiauKai",serif}.seizure-inventory header h1{font-size:1.35rem;font-weight:400;letter-spacing:.08em;margin:0 0 10px}.inventory-table{table-layout:fixed}.inventory-table th{font-weight:400;text-align:center;vertical-align:middle}.inventory-table td{height:54px;text-align:center;vertical-align:middle}.inventory-table .inventory-name{text-align:left}.search-record-page{font-family:"DFKai-SB","標楷體","BiauKai",serif;font-size:.92rem;line-height:1.45}.search-record-title h1{font-size:1.35rem;margin:0 0 8px}.search-record-agency{display:grid;grid-template-columns:1fr auto;align-items:center;border:1px solid #333;padding:4px 10px}.search-record-agency strong{font-size:1.2rem;font-weight:400}.search-record-agency span{border-left:1px solid #333;padding-left:10px}.search-record-table{margin:0;table-layout:fixed}.search-record-table th{width:10%;padding:6px;text-align:center;vertical-align:middle;font-weight:400}.search-record-table td{padding:5px 8px;vertical-align:top}.search-record-table p{margin:3px 0}.search-record-table.page-two th{width:9%}.search-record-table.page-two>tbody>tr:first-child>td{height:145px}.search-record-table.page-two .procedure-checks{height:355px}.search-record-table.page-two>tbody>tr:last-child>td{height:185px}.search-record-final{border:1px solid #333;padding:12px 16px;min-height:390px}.search-record-final p{margin:12px 0}.search-record-signer{display:flex;align-items:center;gap:8px;min-height:52px}.search-record-signer img{max-width:180px;max-height:58px;object-fit:contain}.search-record-notes{margin-top:14px;padding-left:28px}.search-record-notes li{margin:7px 0}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${content}</body></html>`;

export async function documentHash(content) {
  return sha256(content);
}
