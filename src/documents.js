import { escapeHtml, rocDate, rocDateTime, sha256 } from "./utils.js";

const table = rows => `<table>${rows.map(([key, value]) =>
  `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value ?? "")}</td></tr>`).join("")}</table>`;

export function photoCaption(evidence, type, index = 1) {
  const number = evidence.number || "未編號";
  if (type === "發現位置照片") return `圖${index}：證物編號${number}於上址${evidence.locationText || "未填位置"}發現時之情形。`;
  if (type === "秤重照片") {
    return `圖${index}：證物編號${number}之${evidence.name || "證物"}${evidence.quantity || ""}${evidence.quantityUnit || ""}，連同包裝經電子磅秤秤得毛重${evidence.grossWeight || "未填"}${evidence.weightUnit || "公克"}。`;
  }
  if (type === "初驗照片") return `圖${index}：證物編號${number}經${evidence.reagent || "未填試劑"}檢驗，${evidence.testResult || "結果未填"}。`;
  return `圖${index}：證物編號${number}之其他採證照片。`;
}

function heading(title, caseData, draft) {
  return `<header><h1 style="white-space:nowrap;font-family:'DFKai-SB','標楷體','BiauKai',serif;font-size:1.2rem">${escapeHtml(title)}</h1>${draft ? '<div class="watermark">未簽署工作稿</div>' : ""}
    <p>案件名稱：${escapeHtml(caseData.name || "未填")}</p></header>`;
}

export function generateDocument(type, caseData, evidenceList, photos, options = {}) {
  const draft = !options.signed;
  let body = "";
  if (type === "搜索扣押筆錄") {
    body = searchSeizureRecord(caseData, evidenceList, options, draft);
  } else if (type === "毒品初步鑑驗報告單" || type === "毒品初步檢驗紀錄表") {
    const drugEvidence = evidenceList.filter(item => (item.evidenceCategory || "毒品") === "毒品");
    body = drugPreliminaryReport(caseData, drugEvidence, options, draft);
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
  return `<article class="document" style="font-family:'DFKai-SB','標楷體','BiauKai',serif">${body}<footer>文件版本：${escapeHtml(options.version || "第一版")}</footer></article>`;
}

function evidenceTable(items) {
  return `<table><thead><tr><th>項次</th><th>證物編號</th><th>品名</th><th>外觀</th><th>顏色</th><th>包裝</th><th>數量</th><th>毛重（含包裝）</th><th>初驗結果</th></tr></thead><tbody>
    ${items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.number)}</td><td>${escapeHtml(item.name || item.evidenceCategory)}</td>
    <td>${escapeHtml(item.appearance)}</td><td>${escapeHtml(item.color)}</td><td>${escapeHtml(item.packaging)}</td>
    <td>${escapeHtml(`${item.quantity || ""}${item.quantityUnit || ""}`)}</td><td>${escapeHtml(`${item.grossWeight || ""}${item.weightUnit || ""}`)}</td>
    <td>${escapeHtml(item.testResult)}</td></tr>`).join("")}</tbody></table>`;
}

const mark = checked => checked ? "☑" : "☐";
const line = value => escapeHtml(value || "　　　　　　　　　");

function legalBasisOptions(caseData) {
  return [
    ["出示搜索票", `出示搜索票實施之。${caseData.warrantNumber ? `（${escapeHtml(caseData.warrantNumber)}）` : "（搜索票字號留存於卷內）"}`],
    ["附帶搜索", "依刑事訴訟法第一百三十條執行附帶搜索。"],
    ["逕行搜索", "依刑事訴訟法第一百三十一條第一項執行逕行搜索。理由說明如下："],
    ["檢察官指揮逕行搜索", "依檢察官之指揮執行逕行搜索。"],
    ["同意搜索", "依刑事訴訟法第一百三十一條之一經受搜索人同意執行搜索。"],
    ["出示扣押裁定", "出示扣押裁定實施之。"],
    ["檢察官指揮逕行扣押", "依檢察官之指揮實施逕行扣押。"],
    ["保全追徵扣押", "依刑事訴訟法第一百三十三條第二項執行保全追徵扣押。"],
    ["命提出扣押", "依刑事訴訟法第一百三十三條第三項命所有人、持有人或保管人提出或交付應扣押物予以扣押。"],
    ["同意扣押", "依刑事訴訟法第一百三十三條之一經受扣押人同意執行扣押。"],
    ["逕行扣押", "依刑事訴訟法第一百三十三條之二第三項執行逕行扣押。"],
    ["附帶扣押", "係本案應扣押之物為搜索票未記載，依刑事訴訟法第一百三十七條執行附帶扣押。"],
    ["現場遺留物扣押", "依刑事訴訟法第一百四十三條前段就被告、犯罪嫌疑人或第三人遺留在犯罪現場之物予以扣押。"],
    ["任意提出物扣押", "依刑事訴訟法第一百四十三條後段就所有人或保管人任意提出或交付之物予以扣押。"],
    ["另案扣押", "係另案應扣押之物，依刑事訴訟法第一百五十二條執行另案扣押。"],
    ["其他", "其他依法得執行搜索或扣押之事由。"]
  ].map(([, label]) => `<p>${mark(false)} ${label}</p>`).join("");
}

const chineseSequence = index => ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][index] || String(index + 1);

function drugCaseType(drugEvidence) {
  const text = drugEvidence.map(item => `${item.drugType || ""}${item.name || ""}${item.testResult || ""}`).join(" ");
  return [
    ["嗎啡、海洛因", /嗎啡|海洛因/],
    ["安非他命", /安非他命/],
    ["愷他命", /愷他命|K他命|Ketamine/i]
  ].map(([label, pattern]) => `${mark(pattern.test(text))}${label}`).join("　");
}

function drugPreliminaryReport(caseData, drugEvidence, options, draft) {
  const agency = caseData.agencyName || caseData.unit || "內政部警政署航空警察局臺北分局";
  const unit = caseData.unit || "偵查隊";
  const foundEntries = drugEvidence.map(item =>
    `${rocDateTime(item.foundAt)}　${item.foundAddress || caseData.address || ""}${item.locationText ? `　${item.locationText}` : ""}`
  ).filter(value => value.trim()).join("<br>");
  const testEntries = drugEvidence.map(item =>
    `${rocDateTime(item.testAt)}　${item.foundAddress || caseData.address || ""}`
  ).filter(value => value.trim()).join("<br>");
  const evidenceEntries = drugEvidence.map((item, index) => {
    const name = item.drugType || item.name || "疑似毒品";
    const quantity = `${item.quantity || ""}${item.quantityUnit || ""}`;
    const weight = `${item.grossWeight || ""}${item.weightUnit || ""}`;
    return `<p><strong>${chineseSequence(index)}、扣押物目錄編號：${escapeHtml(item.number || "")}</strong><br>
      種類：${escapeHtml(name)}　數量：${escapeHtml(quantity)}　重量：毛重${escapeHtml(weight)}</p>`;
  }).join("") || "<p>目前沒有毒品證物。</p>";
  const reagent = drugEvidence.map(item => item.reagent).find(Boolean) || "拉曼光譜檢測儀";
  const resultText = drugEvidence.map(item => `${item.testResult || ""}${item.reaction || ""}`).join(" ");
  const reactionOptions = [
    ["嗎啡、海洛因", /嗎啡|海洛因/],
    ["安非他命", /安非他命/],
    ["潘他唑新", /潘他唑新/],
    ["愷他命", /愷他命|K他命|Ketamine/i]
  ].map(([label, pattern]) => `${mark(pattern.test(resultText))}呈${label}反應。`).join("　");
  const signer = options.signature
    ? `<img src="${options.signature}" alt="涉嫌人簽章" style="width:38mm;height:16mm;max-width:38mm;max-height:16mm;object-fit:contain"><span>${escapeHtml(options.signerName || caseData.suspect)}</span>`
    : "____________________________";
  return `<article class="document drug-preliminary-report">
    ${draft ? '<div class="watermark">未簽署工作稿</div>' : ""}
    <header><h1 style="white-space:nowrap;font-size:.95rem;letter-spacing:0">${escapeHtml(agency.replace(/^內政部警政署/, ""))}查獲涉嫌毒品危害防制條例毒品初步鑑驗報告單</h1></header>
    <table class="drug-report-table">
      <tbody>
        <tr><th>案類</th><td>${drugCaseType(drugEvidence)}</td><th>涉嫌人</th><td>${escapeHtml(caseData.suspect || "")}</td></tr>
        <tr><th>查獲時間地點</th><td colspan="3">${foundEntries || "—"}</td></tr>
        <tr><th>初步鑑驗單位</th><td>${escapeHtml(unit)}</td><th>職別姓名</th><td>${escapeHtml(caseData.tester || "")}</td></tr>
        <tr><th>鑑驗時間地點</th><td colspan="3">${testEntries || "—"}</td></tr>
        <tr><th>鑑驗物品及數量</th><td colspan="3" class="drug-items">${evidenceEntries}</td></tr>
        <tr><th>初步鑑驗結果</th><td colspan="3">
          <p>經本單位依 ${escapeHtml(reagent)} 檢驗，初步鑑驗結果：</p>
          <p>${reactionOptions}</p>
          <p>鑑驗測試應在涉嫌人前為之。</p>
          <p class="drug-signer">涉嫌人簽章：${signer}</p>
        </td></tr>
      </tbody>
    </table>
  </article>`;
}

const templateAsset = file => typeof location === "undefined"
  ? `./assets/templates/search-record/${file}`
  : new URL(`./assets/templates/search-record/${file}`, location.href).href;

const templateOverlay = (content, x, y, width, extra = "") =>
  `<div class="search-template-overlay" style="left:${x}%;top:${y}%;width:${width}%;${extra}">${content}</div>`;

function searchSeizureRecord(caseData, evidenceList, options, draft) {
  const shortDateTime = value => escapeHtml(rocDateTime(value).replace(/\d{2}秒$/, ""));
  const warrantText = String(caseData.warrantNumber || "");
  const warrantYear = warrantText.match(/(\d+)\s*年度/)?.[1] || "";
  const warrantSerial = warrantText.match(/字第\s*([^號]+)\s*號/)?.[1] || "";
  const signature = options.signature
    ? `<img src="${options.signature}" alt="受執行人簽名" style="width:38mm;height:16mm;max-width:38mm;max-height:16mm;object-fit:contain">`
    : "";
  const accessibleText = `<div class="template-accessible-text" hidden>
    ${escapeHtml(caseData.agencyName || caseData.unit || "執行機關")}
    搜索筆錄 扣押筆錄 執行時間 執行處所 受執行人 身分 ${escapeHtml(caseData.suspectRole || "")} 姓名 性別 出生年月日 身分證統一編號 住居所 是否在場
    執行之依據 出示搜索票實施之 刑事訴訟法第一百三十七條執行附帶扣押
    執行時告知事項 執行理由：涉嫌 ${escapeHtml(caseData.caseReason || "毒品危害防制條例")} 案
    執行經過情形 有開啟鎖扃、封緘或為其他必要之處分 結果 受執行人簽名捺印
    <span class="search-record-signer">受執行人簽名欄</span>
  </div>`;
  const pageOneOverlays = [
    templateOverlay(`自　${shortDateTime(caseData.searchStart)}　起<br>至　${shortDateTime(caseData.searchEnd)}　止`, 17.8, 10.2, 71, "font-size:10.5pt;line-height:1.55"),
    templateOverlay(escapeHtml(caseData.address || ""), 17.8, 15.2, 72, "font-size:11pt"),
    templateOverlay(escapeHtml(caseData.suspect || ""), 27.2, 22.3, 61, "font-size:11pt"),
    templateOverlay(escapeHtml(caseData.suspectGender || ""), 27.2, 25.6, 61, "font-size:11pt"),
    templateOverlay(escapeHtml(caseData.suspectBirthDate ? rocDate(caseData.suspectBirthDate) : ""), 27.2, 29.5, 61, "font-size:11pt"),
    templateOverlay(escapeHtml(caseData.suspectId || ""), 27.2, 33.5, 61, "font-size:11pt"),
    templateOverlay(escapeHtml(caseData.suspectResidence || caseData.suspectRegisteredAddress || ""), 27.2, 37.2, 61, "font-size:10.5pt"),
    templateOverlay(escapeHtml(caseData.suspectPresent || "是"), 27.2, 40.8, 61, "font-size:11pt"),
    templateOverlay(escapeHtml(warrantYear), 45.7, 46.9, 8, "font-size:10pt;text-align:center"),
    templateOverlay(escapeHtml(warrantSerial), 68.2, 46.9, 9, "font-size:10pt;text-align:center")
  ].join("");
  const pageTwoOverlays = "";
  const pageThreeOverlays = [
    signature ? templateOverlay(signature, 40, 7.4, 30, "height:7%;display:flex;align-items:center;justify-content:center") : "",
    signature ? templateOverlay(signature, 40, 14.9, 30, "height:7%;display:flex;align-items:center;justify-content:center") : "",
    templateOverlay(`${signature}<span>${escapeHtml(options.signerName || caseData.suspect || "")}</span>`, 25, 27.4, 55, "display:flex;align-items:center;gap:6px;font-size:11pt"),
    templateOverlay(escapeHtml(caseData.presentPeople || ""), 25, 31.8, 55, "font-size:11pt"),
    templateOverlay(escapeHtml(caseData.suspectResidence || caseData.address || ""), 25, 36.0, 60, "font-size:10.5pt"),
    templateOverlay(escapeHtml(caseData.executors || "航警臺北分局（偵查隊）"), 25, 40.3, 60, "font-size:10.5pt"),
    templateOverlay(escapeHtml(caseData.recorder || ""), 25, 54.8, 55, "font-size:11pt"),
    templateOverlay(escapeHtml(rocDate(caseData.searchEnd || caseData.searchStart)), 36, 64.0, 51, "font-size:11pt;letter-spacing:.35em")
  ].join("");
  const page = (number, overlays) => `<article class="document search-record-page search-record-template-page">
    ${number === 1 ? accessibleText : ""}<img class="search-record-template-image" src="${templateAsset(`page-${String(number).padStart(2, "0")}.webp`)}" alt="搜索扣押筆錄第${number}頁空白範本">${overlays}
    ${draft ? '<div class="watermark template-watermark">未簽署工作稿</div>' : ""}
  </article>`;
  return `${page(1, pageOneOverlays)}${page(2, pageTwoOverlays)}${page(3, pageThreeOverlays)}`;
}

function legacySearchSeizureRecord(caseData, evidenceList, options, draft) {
  const hasSeizure = evidenceList.length > 0;
  const signer = options.signature
    ? `<img src="${options.signature}" alt="受執行人簽名" style="width:38mm;height:16mm;max-width:38mm;max-height:16mm;object-fit:contain"><span>${escapeHtml(options.signerName || caseData.suspect)}</span>`
    : "（　　　　　　　　　　　　　　）";
  const pageOne = `<article class="document search-record-page">
    <div class="search-record-agency"><strong style="white-space:nowrap">${escapeHtml(caseData.agencyName || caseData.unit || "執行機關")}</strong>
      <span>${mark(false)} 搜索筆錄<br>${mark(false)} 扣押筆錄</span></div>
    ${draft ? '<div class="watermark">未簽署工作稿</div>' : ""}
    <table class="search-record-table">
      <tbody>
        <tr><th>執行時間</th><td>自 ${line(rocDateTime(caseData.searchStart))} 起<br>至 ${line(rocDateTime(caseData.searchEnd))} 止</td></tr>
        <tr><th>執行處所</th><td>${line(caseData.address)}</td></tr>
        <tr><th rowspan="7">受執行人</th><td>身分　${["受搜索人","扣押物所有人","扣押物持有人","扣押物保管人"].map(role => `${mark(false)}${role}`).join("　")}</td></tr>
        <tr><td>姓名　${line(caseData.suspect)}</td></tr>
        <tr><td>性別　${line(caseData.suspectGender)}</td></tr>
        <tr><td>出生年月日　${line(caseData.suspectBirthDate ? rocDate(caseData.suspectBirthDate) : "")}</td></tr>
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
          <p>執行理由：涉嫌 ${escapeHtml(caseData.caseReason || "毒品危害防制條例")} 案</p>
          <p>執行對象：${mark(false)}被告　${mark(false)}犯罪嫌疑人　${mark(false)}第三人</p>
          <p>執行範圍：${mark(false)}處所（同上）　${mark(false)}身體（同上受執行人）<br>${mark(false)}物件：${escapeHtml(caseData.searchObject || "")}　${mark(false)}電磁紀錄</p>
          <p>應扣押之物：${escapeHtml(caseData.seizureTarget || "詳如扣押物品目錄表")}</p>
        </td></tr>
        <tr><th>執行經過情形</th><td class="procedure-checks">
          <p>${mark(false)} 執行人員有出示證件表明身分。</p>
          <p>${mark(false)} 搜索婦女之身體，有命婦女行之。但不能由婦女行之者，原因：____________________</p>
          <p>${mark(false)} 軍事上應秘密之處所，有得該管長官之允許。</p>
          <p>${mark(false)} 對抗拒搜索者，有使用強制力搜索之，未逾必要之程度。</p>
          <p>${mark(false)} 有開啟鎖扃、封緘或為其他必要之處分。有封鎖現場、禁止在場人員離去，或禁止第三人進入現場。對於違反禁止命令者，有命其離開或交由適當之人看管至執行終了。</p>
          <p>${mark(false)} 有人住居或看守之住宅或其他處所，於夜間入內搜索或扣押，有經住居人、看守人或可為代表之人承諾或有急迫之情形者。</p>
          <p>${mark(false)} 搜索右開住宅、處所或船艦，有命住居人或看守人或可為其代表人在場，其不能在場者，有命該住宅、處所或船艦內之人或其鄰居之人或就近自治團體之職員在場，並將搜索票出示在場之人。</p>
          <p>${mark(false)} 對於政府機關公務員或曾為公務員之人所持有或保管之文書及其他物件，為其職務上應守密者，有經該管監督機關或公務員之允許。</p>
          <p>${mark(false)} 其他：________________________________________________</p>
        </td></tr>
        <tr><th>結果</th><td>
          <p>${mark(false)} 經搜索未發現應行扣押物，並付與無應扣押之物證明書。<br>（受搜索人簽名捺印：${signer}）</p>
          <p>${mark(false)} 發現應行扣押物，已扣押並付與扣押物收據，經扣押之物詳如扣押物品目錄表（如附件）。<br>（受執行人簽名捺印：${signer}）</p>
          <p>${mark(false)} 其他：________________________________________________</p>
        </td></tr>
      </tbody>
    </table>
  </article>`;
  const pageThree = `<article class="document search-record-page">
    <div class="search-record-final">
      <p>上開筆錄經受搜索人或受扣押人及在場人親自閱覽或告以要旨確認無訛後，始命其簽捺如後：</p>
      <p class="search-record-signer">受執行人：${options.signature ? signer : line(caseData.suspect)}</p>
      <p>在場人：${line(caseData.presentPeople)}</p>
      <p>住所：${line(caseData.suspectResidence || caseData.address)}</p>
      <p>執行人：${line(caseData.executors || "航警臺北分局（偵查隊）")}</p>
      <p>紀錄人：${line(caseData.recorder)}</p>
      <p>中華民國　${line(rocDateTime(caseData.searchEnd || caseData.searchStart))}</p>
    </div>
    <ol class="search-record-notes">
      <li>本筆錄可供執行搜索扣押或未經搜索之單純扣押之用，請依實際執行情形填寫。</li>
      <li>經受搜索人出於自願性同意搜索者，應請受搜索人簽名捺印。</li>
      <li>執行結果發給無應扣押之物證明書或扣押物收據，應請受執行人簽名捺印。</li>
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
    <header><h1 style="white-space:nowrap;font-size:1.05rem;letter-spacing:0">${escapeHtml(caseData.agencyName || caseData.unit || "執行機關")}扣押物品目錄表</h1>${draft ? '<div class="watermark">未簽署工作稿</div>' : ""}</header>
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
<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}body{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;color:#111;margin:0;background:#fff}.document{width:100%;min-height:273mm;padding:6mm;background:#fff;break-after:page}.document:last-child{break-after:auto}h1{text-align:center}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #333;padding:8px;text-align:left}.watermark{color:#b42318;border:3px solid #b42318;padding:8px;text-align:center;font-weight:bold}.photo-grid{display:grid;grid-template-columns:1fr;gap:18px}figure{break-inside:avoid;margin:0;border:1px solid #555;padding:10px}figure img{width:100%;max-height:280px;object-fit:contain}.signature-box img{max-width:260px;max-height:120px}.signature-line{height:100px;border-bottom:1px solid #333}.page-break{break-after:page;height:0}footer{margin-top:20px;font-size:12px}.seizure-inventory{font-family:"DFKai-SB","標楷體","BiauKai",serif}.seizure-inventory header h1{font-size:1.35rem;font-weight:400;letter-spacing:.08em;margin:0 0 10px}.inventory-table{table-layout:fixed}.inventory-table th{font-weight:400;text-align:center;vertical-align:middle}.inventory-table td{height:54px;text-align:center;vertical-align:middle}.inventory-table .inventory-name{text-align:left}.search-record-page{font-family:"DFKai-SB","標楷體","BiauKai",serif;font-size:.92rem;line-height:1.45}.search-record-title h1{font-size:1.35rem;margin:0 0 8px}.search-record-agency{display:grid;grid-template-columns:1fr auto;align-items:center;border:1px solid #333;padding:4px 10px}.search-record-agency strong{font-size:1.2rem;font-weight:400}.search-record-agency span{border-left:1px solid #333;padding-left:10px}.search-record-table{margin:0;table-layout:fixed}.search-record-table th{width:10%;padding:6px;text-align:center;vertical-align:middle;font-weight:400}.search-record-table td{padding:5px 8px;vertical-align:top}.search-record-table p{margin:3px 0}.search-record-table.page-two th{width:9%}.search-record-table.page-two>tbody>tr:first-child>td{height:145px}.search-record-table.page-two .procedure-checks{height:355px}.search-record-table.page-two>tbody>tr:last-child>td{height:185px}.search-record-final{border:1px solid #333;padding:12px 16px;min-height:390px}.search-record-final p{margin:12px 0}.search-record-signer{display:flex;align-items:center;gap:8px;min-height:52px}.search-record-signer img{max-width:180px;max-height:58px;object-fit:contain}.search-record-notes{margin-top:14px;padding-left:28px}.search-record-notes li{margin:7px 0}.drug-preliminary-report{font-family:"DFKai-SB","標楷體","BiauKai",serif;font-size:.95rem}.drug-preliminary-report h1{font-size:1.25rem;line-height:1.5;font-weight:400}.drug-report-table{table-layout:fixed}.drug-report-table th{width:15%;text-align:center;vertical-align:middle;font-weight:400}.drug-report-table td{vertical-align:top}.drug-report-table tr:first-child td{width:35%}.drug-items p{margin:5px 0 12px}.drug-signer{min-height:58px;display:flex;align-items:center;gap:8px}.drug-signer img{max-width:180px;max-height:58px;object-fit:contain}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}</style></head><body>${content}</body></html>`;

export async function documentHash(content) {
  return sha256(content);
}

export function preparePrintDocument(content) {
  const totalPages = (content.match(/<article class="document(?:\s|\")/g) || []).length || 1;
  let currentPage = 0;
  const numbered = content.replace(/<\/article>/g, () => {
    currentPage += 1;
    return `<div class="document-page-number">第${currentPage}頁，共${totalPages}頁</div></article>`;
  });
  return `<style id="formal-print-overrides">
    @page{size:A4 portrait;margin:0}
    html,body{margin:0!important;padding:0!important;background:#fff!important}
    .document,.document *{font-family:"Kaiti TC","BiauKai","DFKai-SB","標楷體","KaiTi",serif!important}
    .document{position:relative;width:210mm!important;min-height:297mm!important;padding:12mm 16mm 17mm!important;margin:0!important;box-shadow:none!important;overflow:hidden}
    .document h1,.search-record-agency strong{white-space:nowrap!important}
    .document img[alt="受執行人簽名"],.document img[alt="涉嫌人簽章"],.document img[alt="簽名"]{display:inline-block!important;width:38mm!important;height:16mm!important;max-width:38mm!important;max-height:16mm!important;object-fit:contain!important;vertical-align:middle!important}
    .search-record-template-page{position:relative!important;width:210mm!important;height:297mm!important;min-height:297mm!important;padding:0!important;overflow:hidden!important;background:#fff!important}
    .search-record-template-image{position:absolute!important;z-index:0;inset:0;width:210mm!important;height:297mm!important;max-width:none!important;max-height:none!important;object-fit:fill!important}
    .search-template-overlay{position:absolute;z-index:2;white-space:nowrap;overflow:hidden;color:#000;font-weight:400}
    .template-watermark{position:absolute;z-index:3;left:35%;top:4%;width:30%;background:#fff9}
    .document-page-number{position:absolute;right:16mm;bottom:7mm;font-size:10pt;line-height:1;white-space:nowrap}
    .print-navigation{position:sticky;z-index:20;top:0;display:flex;gap:8px;padding:10px;background:#f5f8fa;border-bottom:1px solid #cbd8df;font-family:-apple-system,"Microsoft JhengHei",sans-serif!important}.print-navigation button{min-height:44px;padding:8px 14px;border:1px solid #9fb1bc;border-radius:9px;background:#fff;color:#123047;font:700 16px -apple-system,"Microsoft JhengHei",sans-serif}
    @media print{html,body{width:210mm}.print-navigation{display:none!important}.document{break-after:page;page-break-after:always}.document:last-of-type{break-after:auto;page-break-after:auto}}
  </style>${numbered}`;
}
