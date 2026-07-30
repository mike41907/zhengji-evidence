import { byCase, get, getAll, importDatabase, openDatabase, put, remove, seedDefaults } from "./db.js";
import { calculateNet, chineseNumber, downloadBlob, escapeHtml, inputToIso, localInputValue, nowIso, rocDateTime, sha256, toast, uuid } from "./utils.js";
import { documentHash, generateDocument, photoCaption, wrapDocument } from "./documents.js";
import { collectCase, exportAllBackup, exportCase } from "./exporter.js";

const app = document.querySelector("#app");
const state = { page: "首頁", caseId: "", evidenceId: "", step: 1, documentType: "搜索扣押筆錄", previewRead: false };
const documentTypes = ["搜索扣押筆錄", "毒品初步檢驗紀錄表", "證物照片紀錄", "扣押物品清冊"];
const statuses = ["草稿", "採證中", "已完成", "待簽署", "已簽署", "已作廢"];

function shell(content, title = "證跡") {
  app.innerHTML = `<header class="topbar"><button class="brand" data-go="首頁"><span>證跡</span><small>證物採證與文件產製系統</small></button>
    <div><span class="offline" id="network-status">${navigator.onLine ? "本機運作中" : "離線運作中"}</span></div></header>
    <main><div class="page-heading">${state.page !== "首頁" ? '<button class="back" data-back>返回</button>' : ""}<h1>${escapeHtml(title)}</h1></div>${content}</main>
    <footer class="app-footer">證跡第一版｜資料只保存在此裝置</footer>`;
  bindGlobal();
}

function bindGlobal() {
  document.querySelectorAll("[data-go]").forEach(button => button.onclick = () => navigate(button.dataset.go, button.dataset.id));
  document.querySelector("[data-back]")?.addEventListener("click", () => history.back());
}

function navigate(page, id = "") {
  state.page = page;
  if (page === "案件詳情") state.caseId = id || state.caseId;
  if (page === "證物採證") state.evidenceId = id || state.evidenceId;
  history.pushState({ page, id }, "", `#${encodeURIComponent(page)}${id ? `/${id}` : ""}`);
  render();
}

window.addEventListener("popstate", event => {
  const saved = event.state || { page: "首頁" };
  state.page = saved.page;
  if (saved.page === "案件詳情") state.caseId = saved.id;
  if (saved.page === "證物採證") state.evidenceId = saved.id;
  render();
});

window.addEventListener("online", () => document.querySelector("#network-status") && (document.querySelector("#network-status").textContent = "本機運作中"));
window.addEventListener("offline", () => document.querySelector("#network-status") && (document.querySelector("#network-status").textContent = "離線運作中"));

async function render() {
  try {
    if (state.page === "首頁") await renderHome();
    else if (state.page === "案件列表") await renderCaseList();
    else if (state.page === "新增案件") await renderCaseForm();
    else if (state.page === "案件詳情") await renderCaseDetail();
    else if (state.page === "證物採證") await renderEvidenceWizard();
    else if (state.page === "文件中心") await renderDocuments();
    else if (state.page === "簽署") await renderSignature();
    else if (state.page === "資料管理") await renderDataManager();
    else if (state.page === "選項管理") await renderOptionManager();
    else await renderHome();
  } catch (error) {
    console.error(error);
    shell(`<section class="panel danger"><h2>畫面載入失敗</h2><p>${escapeHtml(error.message)}</p><button data-go="首頁">返回首頁</button></section>`, "發生錯誤");
  }
}

async function renderHome() {
  const cases = await getAll("cases");
  const counts = Object.fromEntries(statuses.map(status => [status, cases.filter(item => item.status === status).length]));
  shell(`<section class="hero"><p class="eyebrow">完全本地端・可離線使用</p><h1>現場採證，循序完成</h1><p>案件、照片、簽名與文件不會上傳。</p>
    <button class="primary large" data-go="新增案件">新增案件</button></section>
    <section class="status-grid">
      ${["採證中", "已完成", "待簽署", "已簽署"].map(status => `<button class="status-card" data-go="案件列表"><strong>${counts[status]}</strong><span>${status}案件</span></button>`).join("")}
    </section>
    <section class="menu-grid">
      <button data-go="案件列表"><span class="menu-icon">案</span><strong>全部案件</strong><small>搜尋、篩選與繼續採證</small></button>
      <button data-go="選項管理"><span class="menu-icon">選</span><strong>預設選項管理</strong><small>常用選項、人員與地址</small></button>
      <button data-go="資料管理"><span class="menu-icon">備</span><strong>備份與還原</strong><small>匯入、匯出與完整備份</small></button>
      <button id="install-button"><span class="menu-icon">裝</span><strong>加入裝置主畫面</strong><small>安裝後可快速開啟</small></button>
    </section>`, "證跡");
  let installPrompt;
  window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); installPrompt = event; }, { once: true });
  document.querySelector("#install-button").onclick = async () => {
    if (installPrompt) await installPrompt.prompt();
    else toast("請使用瀏覽器選單中的「加到主畫面」或「安裝應用程式」。");
  };
}

async function renderCaseList() {
  const cases = (await getAll("cases")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  shell(`<section class="toolbar"><input id="case-search" type="search" placeholder="搜尋案號、案件名稱或嫌疑人"><select id="case-filter">
    <option value="">全部狀態</option>${statuses.map(item => `<option>${item}</option>`).join("")}</select><button class="primary" data-go="新增案件">新增案件</button></section>
    <section id="case-list" class="case-list">${await caseCards(cases)}</section>`, "案件列表");
  const refresh = async () => {
    const term = document.querySelector("#case-search").value.trim();
    const filter = document.querySelector("#case-filter").value;
    const filtered = cases.filter(item => (!term || `${item.caseNumber}${item.name}${item.suspect}`.includes(term)) && (!filter || item.status === filter));
    document.querySelector("#case-list").innerHTML = await caseCards(filtered);
    bindGlobal();
  };
  document.querySelector("#case-search").oninput = refresh;
  document.querySelector("#case-filter").onchange = refresh;
}

async function caseCards(cases) {
  if (!cases.length) return `<div class="empty"><h2>尚無案件</h2><p>建立第一個案件後，即可開始採證。</p></div>`;
  return (await Promise.all(cases.map(async item => {
    const evidence = await byCase("evidence", item.id);
    const complete = evidence.filter(entry => entry.status === "採證完成").length;
    return `<button class="case-card" data-go="案件詳情" data-id="${item.id}">
      <div><span class="badge ${statusClass(item.status)}">${escapeHtml(item.status)}</span><h2>${escapeHtml(item.name || "未命名案件")}</h2>
      <p>${escapeHtml(item.caseNumber || "案號未填")}｜${escapeHtml(item.suspect || "嫌疑人未填")}</p></div>
      <div class="case-meta"><span>建立：${rocDateTime(item.createdAt)}</span><span>證物：${evidence.length} 件</span><span>完成：${complete}/${evidence.length}</span></div></button>`;
  }))).join("");
}

function statusClass(status) {
  return ({ "已完成": "done", "已簽署": "done", "待簽署": "warning", "採證中": "active", "已作廢": "danger" })[status] || "";
}

async function renderCaseForm(existing) {
  const data = existing || {
    id: uuid(), caseNumber: "", name: "", reason: "違反毒品危害防制條例", suspect: "", unit: "", address: "",
    executionDate: nowIso(), searchStart: "", searchEnd: "", officer: "", recorder: "", tester: "", executors: "",
    presentPeople: "", notes: "", status: "草稿", createdAt: nowIso(), updatedAt: nowIso(), lockedAt: ""
  };
  shell(`<form id="case-form" class="panel form-grid">
    ${field("案號", "caseNumber", data.caseNumber, true)}${field("案件名稱", "name", data.name, true)}
    ${selectField("案由", "reason", ["違反毒品危害防制條例", "持有毒品", "販賣毒品", "施用毒品", "其他"], data.reason)}
    ${field("犯罪嫌疑人姓名", "suspect", data.suspect, true)}${field("執行單位", "unit", data.unit, true)}
    ${field("執行地址", "address", data.address, true, "完整門牌地址")}
    ${dateField("搜索開始時間", "searchStart", data.searchStart)}${dateField("搜索結束時間", "searchEnd", data.searchEnd)}
    ${field("承辦人", "officer", data.officer)}${field("製作筆錄人員", "recorder", data.recorder)}
    ${field("初驗人員", "tester", data.tester)}${field("執行人員", "executors", data.executors)}
    ${field("在場人員", "presentPeople", data.presentPeople)}${selectField("案件狀態", "status", statuses, data.status)}
    <label class="wide">備註<textarea name="notes" rows="3">${escapeHtml(data.notes)}</textarea></label>
    <div class="sticky-actions"><button type="button" data-back>取消</button><button class="primary" type="submit">儲存案件</button></div>
  </form>`, existing ? "修改案件資料" : "新增案件");
  document.querySelector("#case-form").onsubmit = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.caseNumber.trim() || !values.name.trim() || !values.suspect.trim() || !values.unit.trim() || !values.address.trim()) {
      return toast("請完成案號、案件名稱、犯罪嫌疑人、執行單位與執行地址。", "錯誤");
    }
    const item = { ...data, ...values, searchStart: inputToIso(values.searchStart), searchEnd: inputToIso(values.searchEnd), updatedAt: nowIso() };
    await put("cases", item);
    toast("案件已儲存。");
    state.caseId = item.id;
    navigate("案件詳情", item.id);
  };
}

function field(label, name, value = "", required = false, placeholder = "") {
  return `<label>${escapeHtml(label)}${required ? "<em>必填</em>" : ""}<input name="${name}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${required ? "required" : ""}></label>`;
}
function dateField(label, name, value) {
  return `<label>${label}<input type="datetime-local" name="${name}" value="${localInputValue(value)}"><small>${value ? rocDateTime(value) : "尚未設定"}</small></label>`;
}
function selectField(label, name, options, value) {
  return `<label>${label}<select name="${name}">${options.map(item => `<option ${item === value ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}</select></label>`;
}

async function renderCaseDetail() {
  const caseData = await get("cases", state.caseId);
  if (!caseData) return navigate("案件列表");
  const bundle = await collectCase(caseData.id);
  const completion = bundle.evidence.length ? Math.round(bundle.evidence.filter(item => item.status === "採證完成").length / bundle.evidence.length * 100) : 0;
  shell(`<section class="case-summary panel"><div><span class="badge ${statusClass(caseData.status)}">${caseData.status}</span><h2>${escapeHtml(caseData.name)}</h2>
    <p>${escapeHtml(caseData.caseNumber)}｜${escapeHtml(caseData.reason)}</p><p>${escapeHtml(caseData.address)}</p></div>
    <div class="progress-ring"><strong>${completion}%</strong><span>採證完成度</span></div></section>
    <section class="action-row"><button id="edit-case">修改案件資料</button><button class="primary" id="add-evidence">新增證物</button>
      <button data-go="文件中心">產生文件</button><button id="export-case">匯出完整案件</button></section>
    <section><div class="section-title"><h2>證物卡片</h2><span>${bundle.evidence.length} 件</span></div>
    <div class="evidence-list">${await evidenceCards(bundle.evidence)}</div></section>
    <section class="danger-zone"><h2>案件管理</h2><button id="lock-case">鎖定案件</button><button class="danger-button" id="void-case">作廢案件</button></section>`, "案件詳情");
  document.querySelector("#edit-case").onclick = () => renderCaseForm(caseData);
  document.querySelector("#add-evidence").onclick = () => createEvidence(caseData, bundle.evidence);
  document.querySelector("[data-go='文件中心']").onclick = () => navigate("文件中心");
  document.querySelector("#export-case").onclick = async () => {
    try { await exportCase(caseData, bundle.evidence, bundle.photos, bundle.documents, bundle.signatures); toast("完整案件壓縮檔已產生。"); }
    catch (error) { toast(error.message, "錯誤"); }
  };
  document.querySelector("#lock-case").onclick = async () => {
    if (!confirm("確定鎖定此案件？鎖定後須先建立新版本才能修改。")) return;
    await put("cases", { ...caseData, status: "已完成", lockedAt: nowIso(), updatedAt: nowIso() });
    renderCaseDetail();
  };
  document.querySelector("#void-case").onclick = async () => {
    const reason = prompt("請輸入作廢原因：");
    if (!reason || !confirm("確定作廢此案件？原始資料仍會保留。")) return;
    await put("cases", { ...caseData, status: "已作廢", voidReason: reason, updatedAt: nowIso() });
    renderCaseDetail();
  };
}

async function evidenceCards(items) {
  if (!items.length) return `<div class="empty"><h3>尚未新增證物</h3><p>新增後會依採證順序逐步引導。</p></div>`;
  return (await Promise.all(items.sort((a, b) => a.sequence - b.sequence).map(async item => {
    const photos = (await byCase("photos", item.caseId)).filter(photo => photo.evidenceId === item.id);
    const checks = validateEvidence(item, photos);
    return `<button class="evidence-card" data-go="證物採證" data-id="${item.id}"><div><span class="evidence-number">${escapeHtml(item.number)}</span>
      <h3>${escapeHtml(item.name || "尚未填寫證物名稱")}</h3><p>${escapeHtml(item.drugType || "種類未選")}｜${escapeHtml(item.quantity || "0")}${escapeHtml(item.quantityUnit || "")}</p></div>
      <div>${checks.length ? `<span class="badge danger">缺漏 ${checks.length} 項</span><small>${escapeHtml(checks.slice(0, 2).join("、"))}</small>` : '<span class="badge done">採證完成</span>'}</div></button>`;
  }))).join("");
}

async function createEvidence(caseData, current) {
  if (caseData.status === "已簽署" || caseData.status === "已作廢") return toast("已簽署或已作廢案件不得直接新增證物。", "錯誤");
  const sequence = current.length + 1;
  const prefix = localStorage.getItem("證物編號格式") || "證";
  const item = {
    id: uuid(), caseId: caseData.id, sequence, number: `${prefix}${chineseNumber(sequence)}`, name: "疑似毒品",
    drugType: "", appearance: "", color: "", packaging: "", quantity: "", quantityUnit: "包",
    grossWeight: "", packageWeight: "", netWeight: "", weightUnit: "公克", foundAddress: caseData.address,
    space: "", exactLocation: "", positionExtra: "", locationText: "", foundAt: "", foundOriginalAt: "", foundTimeSource: "",
    weighedAt: "", weighedOriginalAt: "", weighedTimeSource: "", reagent: "", testResult: "", reaction: "",
    testAt: "", testOriginalAt: "", testTimeSource: "", notes: "", status: "採證中", createdAt: nowIso(), updatedAt: nowIso()
  };
  await put("evidence", item);
  state.evidenceId = item.id; state.step = 1;
  navigate("證物採證", item.id);
}

async function renderEvidenceWizard() {
  const evidence = await get("evidence", state.evidenceId);
  if (!evidence) return navigate("案件詳情", state.caseId);
  state.caseId = evidence.caseId;
  const caseData = await get("cases", evidence.caseId);
  const photos = (await byCase("photos", evidence.caseId)).filter(item => item.evidenceId === evidence.id);
  const stepNames = ["發現位置", "證物資料", "秤重", "毒品初驗", "完整檢查"];
  shell(`<section class="wizard-head"><div><span class="evidence-number">${escapeHtml(evidence.number)}</span><h2>${escapeHtml(evidence.name)}</h2></div>
    <div class="stepper">${stepNames.map((name, index) => `<button class="${state.step === index + 1 ? "current" : state.step > index + 1 ? "complete" : ""}" data-step="${index + 1}"><span>${index + 1}</span><small>${name}</small></button>`).join("")}</div></section>
    <section id="wizard-content" class="panel">${await wizardStep(state.step, evidence, photos, caseData)}</section>
    <nav class="wizard-nav"><button id="previous-step" ${state.step === 1 ? "disabled" : ""}>上一步</button><button id="save-step">儲存</button>
      <button class="primary" id="next-step">${state.step === 5 ? "返回案件" : "確認並下一步"}</button></nav>`, "證物採證");
  bindWizard(evidence, photos, caseData);
}

async function wizardStep(step, evidence, photos, caseData) {
  if (step === 1) return photoStep("發現位置照片", photos, evidence, "foundAt", "查獲時間") + `
    <h3>發現位置快速組合</h3><div class="form-grid">${await optionSelect("空間位置", "space", evidence.space)}${await optionSelect("具體位置", "exactLocation", evidence.exactLocation)}
    ${await optionSelect("位置補充", "positionExtra", evidence.positionExtra)}<label class="wide">完整位置說明<textarea name="locationText">${escapeHtml(evidence.locationText)}</textarea></label></div>`;
  if (step === 2) return `<div class="form-grid">${field("證物編號", "number", evidence.number, true)}${field("證物名稱", "name", evidence.name, true)}
    ${await optionSelect("疑似毒品種類", "drugType", evidence.drugType)}${await optionSelect("證物外觀", "appearance", evidence.appearance)}
    ${await optionSelect("顏色", "color", evidence.color)}${await optionSelect("包裝方式", "packaging", evidence.packaging)}
    <label>數量<div class="quick-values">${[1,2,3,4,5,10].map(value => `<button type="button" data-quantity="${value}">${value}</button>`).join("")}</div><input type="number" inputmode="numeric" min="1" name="quantity" value="${escapeHtml(evidence.quantity)}"></label>
    ${await optionSelect("數量單位", "quantityUnit", evidence.quantityUnit)}</div>`;
  if (step === 3) return `<div class="form-grid"><label>毛重<em>必填</em><input type="number" inputmode="decimal" min="0" step="0.01" name="grossWeight" value="${escapeHtml(evidence.grossWeight)}"></label>
    <label>包裝重量<input type="number" inputmode="decimal" min="0" step="0.01" name="packageWeight" value="${escapeHtml(evidence.packageWeight)}"></label>
    <label>淨重<input name="netWeight" value="${escapeHtml(evidence.netWeight)}" readonly></label>${await optionSelect("重量單位", "weightUnit", evidence.weightUnit)}</div>
    ${photoStep("秤重照片", photos, evidence, "weighedAt", "秤重時間")}`;
  if (step === 4) return `<div class="form-grid">${await optionSelect("初驗試劑", "reagent", evidence.reagent)}${await optionSelect("初驗結果", "testResult", evidence.testResult)}
    <label class="wide">反應情形<textarea name="reaction">${escapeHtml(evidence.reaction)}</textarea></label></div>${photoStep("初驗照片", photos, evidence, "testAt", "初驗時間")}`;
  const issues = validateEvidence(evidence, photos);
  return `<section class="completion ${issues.length ? "has-errors" : ""}"><div class="completion-mark">${issues.length ? "！" : "✓"}</div>
    <h2>${issues.length ? "尚有資料需要補齊" : "採證完成"}</h2>${issues.length ? `<ul>${issues.map(issue => `<li>${escapeHtml(issue)}</li>`).join("")}</ul>` : "<p>照片、時間、重量與初驗資料皆已完成。</p>"}
    <button id="generate-captions">重新產生照片說明</button></section>`;
}

async function optionSelect(category, name, value) {
  const options = (await getAll("options")).filter(item => item.category === category && item.enabled)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.favorite) - Number(a.favorite) || b.useCount - a.useCount || a.order - b.order);
  return `<label>${category}<select name="${name}"><option value="">請選擇</option>${options.map(item => `<option value="${escapeHtml(item.name)}" ${item.name === value ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>`;
}

function photoStep(type, photos, evidence, timeKey, label) {
  const photo = photos.find(item => item.type === type);
  const source = photo && (photo.preview || photo.original);
  const sourceUrl = source instanceof Blob ? URL.createObjectURL(source) : source;
  const sourceKey = timeKey.replace("At", "TimeSource");
  return `<section class="photo-capture"><h2>${type}</h2>${photo ? `<div class="photo-preview"><img src="${sourceUrl}" alt="${type}">
    <div><strong>${escapeHtml(photo.fileName)}</strong><span>${Math.round(photo.size / 1024)} 千位元組</span><span>摘要：${photo.hash.slice(0, 16)}…</span></div></div>` : `<div class="camera-placeholder">尚未拍攝</div>`}
    <label class="camera-button">拍攝或選取照片<input type="file" accept="image/*" capture="environment" data-photo-type="${type}"></label>
    <div class="time-card"><strong>${label}</strong><span>${rocDateTime(evidence[timeKey])}</span><small>時間來源：${escapeHtml(evidence[sourceKey] || "尚未取得")}</small>
    <div class="time-actions"><button type="button" data-time-now="${timeKey}">使用現在時間</button><button type="button" data-time-edit="${timeKey}">手動修改</button><button type="button" data-time-clear="${timeKey}">清除時間</button></div></div></section>`;
}

function bindWizard(evidence, photos, caseData) {
  document.querySelectorAll("[data-step]").forEach(button => button.onclick = async () => { await saveWizard(evidence); state.step = Number(button.dataset.step); renderEvidenceWizard(); });
  document.querySelector("#previous-step").onclick = async () => { await saveWizard(evidence); state.step -= 1; renderEvidenceWizard(); };
  document.querySelector("#save-step").onclick = async () => { await saveWizard(evidence); toast("本步驟已儲存。"); };
  document.querySelector("#next-step").onclick = async () => {
    const saved = await saveWizard(evidence);
    if (!saved) return;
    if (state.step === 5) return navigate("案件詳情", evidence.caseId);
    state.step += 1; renderEvidenceWizard();
  };
  document.querySelectorAll("[data-quantity]").forEach(button => button.onclick = () => {
    document.querySelector("[name='quantity']").value = button.dataset.quantity;
    document.querySelector("[name='quantity']").dispatchEvent(new Event("change"));
  });
  document.querySelectorAll("[name='grossWeight'],[name='packageWeight']").forEach(input => input?.addEventListener("input", () => {
    try { document.querySelector("[name='netWeight']").value = calculateNet(document.querySelector("[name='grossWeight']").value, document.querySelector("[name='packageWeight']").value); }
    catch (error) { toast(error.message, "錯誤"); }
  }));
  document.querySelectorAll("[data-photo-type]").forEach(input => input.onchange = event => addPhoto(event.target.files[0], event.target.dataset.photoType, evidence, photos));
  document.querySelectorAll("[data-time-now]").forEach(button => button.onclick = async () => updateTime(evidence, button.dataset.timeNow, nowIso(), "系統拍攝時間"));
  document.querySelectorAll("[data-time-clear]").forEach(button => button.onclick = async () => updateTime(evidence, button.dataset.timeClear, "", ""));
  document.querySelectorAll("[data-time-edit]").forEach(button => button.onclick = async () => {
    const current = evidence[button.dataset.timeEdit] ? localInputValue(evidence[button.dataset.timeEdit]) : "";
    const value = prompt("請輸入日期時間，格式為年-月-日 時:分", current.replace("T", " "));
    if (value) await updateTime(evidence, button.dataset.timeEdit, new Date(value).toISOString(), "人工修正");
  });
  document.querySelector("#generate-captions")?.addEventListener("click", async () => {
    let index = 0;
    for (const photo of photos) { index += 1; await put("photos", { ...photo, caption: photoCaption(evidence, photo.type, index) }); }
    toast("照片說明已重新產生。"); renderEvidenceWizard();
  });
  document.querySelectorAll("input,select,textarea").forEach(element => {
    if (!element.matches("[type='file']")) element.addEventListener("change", () => saveWizard(evidence));
  });
}

async function saveWizard(evidence) {
  const inputs = document.querySelectorAll("#wizard-content [name]");
  const changes = {};
  for (const input of inputs) changes[input.name] = input.value;
  if ("number" in changes) {
    const siblings = (await byCase("evidence", evidence.caseId)).filter(item => item.id !== evidence.id);
    if (siblings.some(item => item.number === changes.number)) {
      toast("證物編號重複，請重新選擇或輸入。", "錯誤"); return false;
    }
  }
  try {
    if ("grossWeight" in changes || "packageWeight" in changes) {
      changes.netWeight = calculateNet(changes.grossWeight ?? evidence.grossWeight, changes.packageWeight ?? evidence.packageWeight);
    }
  } catch (error) { toast(error.message, "錯誤"); return false; }
  if ("space" in changes || "exactLocation" in changes || "positionExtra" in changes) {
    const space = changes.space ?? evidence.space, exact = changes.exactLocation ?? evidence.exactLocation, extra = changes.positionExtra ?? evidence.positionExtra;
    if (!document.querySelector("[name='locationText']")?.dataset.edited) changes.locationText = `於上址${space || ""}${exact || ""}${extra || ""}發現。`;
  }
  const photos = (await byCase("photos", evidence.caseId)).filter(item => item.evidenceId === evidence.id);
  const updated = { ...evidence, ...changes, updatedAt: nowIso() };
  updated.status = validateEvidence(updated, photos).length ? "採證中" : "採證完成";
  await put("evidence", updated);
  Object.assign(evidence, updated);
  return true;
}

async function addPhoto(file, type, evidence, existing) {
  if (!file) return;
  if (!file.type.startsWith("image/")) return toast("所選檔案不是支援的照片格式。", "錯誤");
  const importedAt = nowIso();
  const fromCamera = file.lastModified === 0 || Math.abs(Date.now() - file.lastModified) < 120000;
  const finalAt = fromCamera ? importedAt : new Date(file.lastModified || Date.now()).toISOString();
  const timeSource = fromCamera ? "系統拍攝時間" : file.lastModified ? "檔案最後修改時間" : "系統匯入時間";
  const hash = await sha256(file);
  const preview = await makePreview(file);
  const old = existing.find(item => item.type === type);
  const photo = {
    id: old?.id || uuid(), caseId: evidence.caseId, evidenceId: evidence.id, type, original: file, preview,
    fileName: file.name || `${type}.jpg`, mime: file.type, size: file.size, width: preview.width, height: preview.height,
    originalAt: finalAt, importedAt, finalAt, timeSource, caption: old?.caption || "", hash, order: ({ "發現位置照片": 1, "秤重照片": 2, "初驗照片": 3 })[type] || 4,
    createdAt: old?.createdAt || importedAt
  };
  photo.caption = photo.caption || photoCaption(evidence, type, photo.order);
  await put("photos", photo);
  const map = { "發現位置照片": "foundAt", "秤重照片": "weighedAt", "初驗照片": "testAt" };
  const key = map[type], sourceKey = key.replace("At", "TimeSource"), originalKey = key.replace("At", "OriginalAt");
  await put("evidence", { ...evidence, [key]: finalAt, [originalKey]: finalAt, [sourceKey]: timeSource, updatedAt: nowIso() });
  toast("照片已保存，並依照片時間自動帶入。"); renderEvidenceWizard();
}

function makePreview(file) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1280 / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => resolve(Object.assign(blob, { width: image.width, height: image.height })), "image/jpeg", 0.78);
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
  });
}

async function updateTime(evidence, key, value, source) {
  const originalKey = key.replace("At", "OriginalAt"), sourceKey = key.replace("At", "TimeSource");
  const update = { ...evidence, [key]: value, [sourceKey]: source, updatedAt: nowIso() };
  if (source === "人工修正") update[originalKey] = evidence[originalKey] || evidence[key];
  await put("evidence", update);
  Object.assign(evidence, update);
  renderEvidenceWizard();
}

export function validateEvidence(item, photos) {
  const issues = [];
  const has = type => photos.some(photo => photo.type === type);
  if (!item.number) issues.push("第二步：證物編號未填");
  if (!item.name) issues.push("第二步：證物名稱未填");
  if (!has("發現位置照片")) issues.push("第一步：缺少發現位置照片");
  if (!item.foundAt) issues.push("第一步：缺少查獲時間");
  if (!item.locationText) issues.push("第一步：缺少查獲位置");
  if (!item.quantity) issues.push("第二步：缺少數量");
  if (!item.grossWeight) issues.push("第三步：缺少毛重");
  if (!has("秤重照片")) issues.push("第三步：缺少秤重照片");
  if (item.testResult && item.testResult !== "未實施初驗" && !item.reagent) issues.push("第四步：有初驗結果但未選初驗試劑");
  if (item.testResult && item.testResult !== "未實施初驗" && !has("初驗照片")) issues.push("第四步：有初驗結果但缺少初驗照片");
  if (has("初驗照片") && !item.testAt) issues.push("第四步：有初驗照片但缺少初驗時間");
  return issues;
}

async function renderDocuments() {
  const caseData = await get("cases", state.caseId);
  const { evidence, photos, documents } = await collectCase(state.caseId);
  const content = generateDocument(state.documentType, caseData, evidence, photos);
  shell(`<section class="document-toolbar">${documentTypes.map(type => `<button data-document="${type}" class="${type === state.documentType ? "active" : ""}">${type}</button>`).join("")}</section>
    <section class="document-actions"><button id="regenerate">重新產生</button><button id="editable-export">匯出可修改文件</button><button id="fixed-export">匯出固定版面文件</button><button class="primary" data-go="簽署">進入簽署流程</button></section>
    <section class="document-preview">${content}</section>`, "文件中心");
  document.querySelectorAll("[data-document]").forEach(button => button.onclick = () => { state.documentType = button.dataset.document; renderDocuments(); });
  document.querySelector("#regenerate").onclick = async () => {
    const html = wrapDocument(content); const hash = await documentHash(html);
    const current = documents.filter(item => item.type === state.documentType);
    await put("documents", { id: uuid(), caseId: caseData.id, type: state.documentType, version: current.length + 1, status: "工作稿", content: html, hash, createdAt: nowIso() });
    toast("已建立新的文件版本。");
  };
  document.querySelector("#editable-export").onclick = () => downloadBlob(new Blob([wrapDocument(content)], { type: "application/msword" }), `${state.documentType}_未簽署工作稿.doc`);
  document.querySelector("#fixed-export").onclick = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(wrapDocument(content)); printWindow.document.close(); printWindow.onload = () => printWindow.print();
  };
  document.querySelector("[data-go='簽署']").onclick = () => navigate("簽署");
}

async function renderSignature() {
  const caseData = await get("cases", state.caseId);
  const { evidence, photos, documents } = await collectCase(state.caseId);
  const issues = evidence.flatMap(item => validateEvidence(item, photos.filter(photo => photo.evidenceId === item.id)).map(issue => `${item.number}：${issue}`));
  const content = generateDocument(state.documentType, caseData, evidence, photos);
  shell(`<section class="notice"><strong>簽署前請完整閱覽文件</strong><p>捲動至文件底部後，才能進行簽署。</p></section>
    ${issues.length ? `<section class="panel danger"><h2>尚無法簽署</h2><ul>${issues.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>` : ""}
    <section id="signature-preview" class="document-preview scroll-preview">${content}<div id="document-end">文件內容結束</div></section>
    <section class="panel signature-form">
      <fieldset><legend>閱讀方式</legend><label><input type="radio" name="reading" value="本人已自行閱覽全文">本人已自行閱覽全文</label>
      <label><input type="radio" name="reading" value="已由執行人員朗讀全文">已由執行人員朗讀全文</label></fieldset>
      <div class="form-grid">${field("簽署人姓名", "signerName", "")}${selectField("簽署人身分", "signerRole", ["犯罪嫌疑人", "受搜索人", "在場人", "執行人員", "初驗人員", "製作筆錄人員", "其他"], "犯罪嫌疑人")}</div>
      <h3>手寫簽名區</h3><canvas id="signature-pad" width="900" height="320"></canvas>
      <div class="action-row"><button id="clear-signature">清除重簽</button><button class="primary" id="confirm-signature" ${issues.length ? "disabled" : ""}>確認簽署</button></div>
    </section>`, "文件簽署");
  const preview = document.querySelector("#signature-preview");
  preview.onscroll = () => { if (preview.scrollTop + preview.clientHeight >= preview.scrollHeight - 30) state.previewRead = true; };
  setupSignaturePad(document.querySelector("#signature-pad"));
  document.querySelector("#clear-signature").onclick = () => clearSignature(document.querySelector("#signature-pad"));
  document.querySelector("#confirm-signature").onclick = async () => {
    const reading = document.querySelector("[name='reading']:checked")?.value;
    const signerName = document.querySelector("[name='signerName']").value.trim();
    const signerRole = document.querySelector("[name='signerRole']").value;
    const canvas = document.querySelector("#signature-pad");
    if (!state.previewRead) return toast("請先完整顯示並閱覽文件內容。", "錯誤");
    if (!reading) return toast("請選擇閱覽或朗讀方式。", "錯誤");
    if (!signerName || !signerRole) return toast("請完成簽署人姓名與身分。", "錯誤");
    if (!canvas.dataset.signed) return toast("簽名區尚未簽名。", "錯誤");
    if (!confirm("確認後將鎖定目前文件版本。如需修改，必須作廢原版本後重新產生並重新簽署。")) return;
    const signedAt = nowIso(), signatureData = canvas.toDataURL("image/png");
    const before = wrapDocument(content), beforeHash = await sha256(before), signatureHash = await sha256(signatureData);
    const version = Math.max(0, ...documents.filter(item => item.type === state.documentType).map(item => item.version)) + 1;
    const signedContent = wrapDocument(generateDocument(state.documentType, caseData, evidence, photos, { signed: true, signature: signatureData, signerName, signerRole, signedAt, version }));
    const finalHash = await sha256(signedContent);
    await put("signatures", { id: uuid(), caseId: caseData.id, documentType: state.documentType, signerName, signerRole, image: signatureData, signedAt, beforeHash, signatureHash, reading, device: navigator.userAgent, createdAt: signedAt });
    await put("documents", { id: uuid(), caseId: caseData.id, type: state.documentType, version, status: "已簽署", content: signedContent, hash: finalHash, beforeHash, signedAt, createdAt: signedAt });
    await put("cases", { ...caseData, status: "已簽署", lockedAt: signedAt, updatedAt: signedAt });
    toast("正式文件已簽署並鎖定。"); navigate("文件中心");
  };
}

function setupSignaturePad(canvas) {
  const context = canvas.getContext("2d"); context.lineWidth = 4; context.lineCap = "round"; context.strokeStyle = "#111";
  let drawing = false;
  const point = event => {
    const rect = canvas.getBoundingClientRect(), source = event.touches?.[0] || event;
    return { x: (source.clientX - rect.left) * canvas.width / rect.width, y: (source.clientY - rect.top) * canvas.height / rect.height };
  };
  const start = event => { event.preventDefault(); drawing = true; const p = point(event); context.beginPath(); context.moveTo(p.x, p.y); };
  const move = event => { if (!drawing) return; event.preventDefault(); const p = point(event); context.lineTo(p.x, p.y); context.stroke(); canvas.dataset.signed = "true"; };
  const end = () => drawing = false;
  canvas.addEventListener("pointerdown", start); canvas.addEventListener("pointermove", move); canvas.addEventListener("pointerup", end); canvas.addEventListener("pointerleave", end);
}
function clearSignature(canvas) { canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height); delete canvas.dataset.signed; }

async function renderDataManager() {
  shell(`<section class="menu-grid data-menu"><button id="backup-all"><strong>匯出全部案件備份</strong><small>包含案件、照片、文件、簽名及設定</small></button>
    <label class="file-card"><strong>還原全部案件</strong><small>匯入證跡備份檔；可選擇合併或取代</small><input id="restore-all" type="file" accept=".json,application/json"></label>
    <label class="file-card"><strong>匯入單一案件備份</strong><small>重複案件識別碼將停止匯入</small><input id="restore-case" type="file" accept=".json,application/json"></label>
    <button id="export-options"><strong>匯出預設選項</strong><small>另存常用選項、人員及地址</small></button></section>
    <section class="panel"><h2>安全提醒</h2><p>備份檔可能包含個人資料、照片與簽名。請存放於受控裝置，不要傳送到未經授權的雲端服務。</p></section>`, "備份與還原");
  document.querySelector("#backup-all").onclick = exportAllBackup;
  document.querySelector("#restore-all").onchange = async event => restoreFile(event.target.files[0], true);
  document.querySelector("#restore-case").onchange = async event => restoreFile(event.target.files[0], false);
  document.querySelector("#export-options").onclick = async () => {
    const data = { version: 1, options: await getAll("options"), addresses: await getAll("addresses"), people: await getAll("people") };
    downloadBlob(new Blob([JSON.stringify(data)], { type: "application/json" }), "證跡_常用資料.json");
  };
}

async function restoreFile(file, allowReplace) {
  try {
    const data = JSON.parse(await file.text());
    const replace = allowReplace && confirm("選擇「確定」將取代裝置內全部資料；選擇「取消」將合併資料。");
    await importDatabase(data, replace);
    toast("備份已完成完整性與版本檢查並還原。"); renderHome();
  } catch (error) { toast(`無法還原：${error.message}`, "錯誤"); }
}

async function renderOptionManager() {
  const options = await getAll("options");
  const categories = [...new Set(options.map(item => item.category))];
  const current = localStorage.getItem("管理選項分類") || categories[0];
  const visible = options.filter(item => item.category === current).sort((a, b) => a.order - b.order);
  shell(`<section class="toolbar"><select id="category-select">${categories.map(item => `<option ${item === current ? "selected" : ""}>${item}</option>`).join("")}</select>
    <button class="primary" id="add-option">新增選項</button></section><section class="option-list">${visible.map(item => `<div class="option-row">
      <div><strong>${escapeHtml(item.name)}</strong><small>${item.builtIn ? "系統內建" : "自訂"}｜使用 ${item.useCount} 次</small></div>
      <div><button data-favorite="${item.id}">${item.favorite ? "取消常用" : "設為常用"}</button><button data-toggle="${item.id}">${item.enabled ? "停用" : "啟用"}</button>
      ${item.builtIn ? "" : `<button class="danger-button" data-delete="${item.id}">刪除</button>`}</div></div>`).join("")}</section>
    <section class="panel"><h2>證物編號格式</h2><div class="quick-values"><button data-prefix="證">證一、證二</button><button data-prefix="甲">甲一、甲二</button></div></section>`, "預設選項管理");
  document.querySelector("#category-select").onchange = event => { localStorage.setItem("管理選項分類", event.target.value); renderOptionManager(); };
  document.querySelector("#add-option").onclick = async () => {
    const name = prompt(`新增「${current}」選項：`);
    if (!name) return;
    await put("options", { id: uuid(), category: current, name, useCount: 0, lastUsedAt: "", order: visible.length + 1, pinned: false, favorite: false, isDefault: false, builtIn: false, enabled: true, createdAt: nowIso(), updatedAt: nowIso() });
    renderOptionManager();
  };
  document.querySelectorAll("[data-favorite]").forEach(button => button.onclick = async () => { const item = await get("options", button.dataset.favorite); await put("options", { ...item, favorite: !item.favorite, updatedAt: nowIso() }); renderOptionManager(); });
  document.querySelectorAll("[data-toggle]").forEach(button => button.onclick = async () => { const item = await get("options", button.dataset.toggle); await put("options", { ...item, enabled: !item.enabled, updatedAt: nowIso() }); renderOptionManager(); });
  document.querySelectorAll("[data-delete]").forEach(button => button.onclick = async () => { if (confirm("確定刪除此自訂選項？")) { await remove("options", button.dataset.delete); renderOptionManager(); } });
  document.querySelectorAll("[data-prefix]").forEach(button => button.onclick = () => { localStorage.setItem("證物編號格式", button.dataset.prefix); toast(`新證物將使用「${button.dataset.prefix}一」格式。`); });
}

async function initialize() {
  await openDatabase(); await seedDefaults();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  history.replaceState({ page: "首頁" }, "", location.pathname);
  render();
}
initialize();
