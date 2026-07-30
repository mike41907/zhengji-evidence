import { byCase, clearAllCaseData, get, getAll, importDatabase, openDatabase, put, remove, seedDefaults } from "./db.js";
import { calculateNet, chineseNumber, downloadBlob, escapeHtml, inputToIso, localInputValue, nowIso, rocDateTime, sha256, toast, uuid } from "./utils.js";
import { documentHash, generateDocument, photoCaption, wrapDocument } from "./documents.js";
import { collectCase, exportAllBackup, exportCase } from "./exporter.js";
import { DEFAULT_SUMMARY_TEMPLATE, renderSummary, SUMMARY_FIELDS, summaryValues, unknownSummaryFields } from "./summary.js";
import { ADDRESS_DATA, CITIES, composeAddress } from "./address.js";
import { APP_VERSION, CHANGELOG } from "./version.js";

const app = document.querySelector("#app");
const state = { page: "首頁", caseId: "", evidenceId: "", step: 1, documentType: "搜索扣押筆錄", previewRead: false };
const documentTypes = ["搜索扣押筆錄", "毒品初步檢驗紀錄表", "證物照片紀錄", "扣押物品目錄表"];
const statuses = ["草稿", "採證中", "已完成", "待簽署", "已簽署", "已作廢"];
const CASE_DRAFT_KEY = "證跡_新增案件草稿";
const evidenceCategories = ["毒品", "毒品施用器具", "電子磅秤", "手機", "現金", "包裝材料", "其他"];

function shell(content, title = "證跡") {
  app.innerHTML = `<header class="topbar"><button class="brand" data-go="首頁"><span>證跡</span><small>證物採證與文件產製系統</small></button>
    <div><span class="offline" id="network-status">${navigator.onLine ? "本機運作中" : "離線運作中"}</span></div></header>
    <main class="app-main"><div class="page-heading">${state.page !== "首頁" ? '<button class="back" data-back>返回</button>' : ""}<h1>${escapeHtml(title)}</h1></div>${content}</main>
    <footer class="app-footer">證跡 v${APP_VERSION}｜資料只保存在此裝置</footer>
    <nav class="mobile-tabbar ${["證物採證", "簽署"].includes(state.page) ? "workflow-hidden" : ""}" aria-label="主要功能">
      <button data-go="首頁" class="${state.page === "首頁" ? "active" : ""}"><span>⌂</span>首頁</button>
      <button data-go="案件列表" class="${["案件列表", "案件詳情", "案件摘要"].includes(state.page) ? "active" : ""}"><span>▤</span>案件</button>
      <button data-go="新增案件" class="${state.page === "新增案件" ? "active primary-tab" : "primary-tab"}"><span>＋</span>新增</button>
      <button data-go="資料管理" class="${state.page === "資料管理" ? "active" : ""}"><span>⇅</span>備份</button>
    </nav>`;
  bindGlobal();
}

function bindGlobal() {
  document.querySelectorAll("[data-go]").forEach(button => button.onclick = () => navigate(button.dataset.go, button.dataset.id));
  document.querySelector("[data-back]")?.addEventListener("click", () => history.back());
  document.querySelectorAll("button,.file-card").forEach(element => {
    element.addEventListener("pointerdown", () => element.classList.add("pressed"));
    ["pointerup", "pointercancel", "pointerleave"].forEach(type => element.addEventListener(type, () => element.classList.remove("pressed")));
  });
}

function navigate(page, id = "") {
  state.page = page;
  if (page === "案件詳情") state.caseId = id || state.caseId;
  if (page === "證物採證") state.evidenceId = id || state.evidenceId;
  history.pushState({ page, id }, "", `#${encodeURIComponent(page)}${id ? `/${id}` : ""}`);
  if (document.startViewTransition) document.startViewTransition(() => render());
  else render();
}

window.addEventListener("popstate", event => {
  const saved = event.state || { page: "首頁" };
  state.page = saved.page;
  if (saved.page === "案件詳情") state.caseId = saved.id;
  if (saved.page === "證物採證") state.evidenceId = saved.id;
  if (document.startViewTransition) document.startViewTransition(() => render());
  else render();
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
    else if (state.page === "案件摘要") await renderCaseSummary();
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
  const cases = (await getAll("cases")).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const counts = Object.fromEntries(statuses.map(status => [status, cases.filter(item => item.status === status).length]));
  const recent = cases.find(item => !["已簽署", "已作廢"].includes(item.status)) || cases[0];
  const savedDraft = localStorage.getItem(CASE_DRAFT_KEY);
  shell(`<section class="home-overview"><div><p class="eyebrow">完全本地端・可離線使用</p><h1>現場案件工作台</h1><p>資料只保存在此裝置。</p></div>
    <button class="primary large" data-go="新增案件">＋ 新增案件</button></section>
    ${recent ? `<button class="continue-case" data-go="案件詳情" data-id="${recent.id}">
      <span><small>繼續上次案件</small><strong>${escapeHtml(recent.name || "未命名案件")}</strong><em>${escapeHtml(recent.status)}｜${rocDateTime(recent.updatedAt)}</em></span><b>繼續 →</b>
    </button>` : savedDraft ? `<button class="continue-case" data-go="新增案件"><span><small>尚有未完成草稿</small><strong>繼續填寫新案件</strong></span><b>繼續 →</b></button>` : ""}
    <section class="status-grid compact">
      ${["採證中", "已完成", "待簽署", "已簽署"].map(status => `<button class="status-card" data-go="案件列表"><strong>${counts[status]}</strong><span>${status}案件</span></button>`).join("")}
    </section>
    <section class="menu-grid compact-menu">
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
  shell(`<section class="toolbar"><input id="case-search" type="search" placeholder="搜尋案件名稱或犯罪嫌疑人"><select id="case-filter">
    <option value="">全部狀態</option>${statuses.map(item => `<option>${item}</option>`).join("")}</select><button class="primary" data-go="新增案件">新增案件</button></section>
    <section id="case-list" class="case-list">${await caseCards(cases)}</section>`, "案件列表");
  const refresh = async () => {
    const term = document.querySelector("#case-search").value.trim();
    const filter = document.querySelector("#case-filter").value;
    const filtered = cases.filter(item => (!term || `${item.name}${item.suspect}`.includes(term)) && (!filter || item.status === filter));
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
      <p>${escapeHtml(item.suspect || "犯罪嫌疑人未填")}｜${escapeHtml(item.reason || "案由未填")}</p></div>
      <div class="case-meta"><span>建立：${rocDateTime(item.createdAt)}</span><span>證物：${evidence.length} 件</span><span>完成：${complete}/${evidence.length}</span></div></button>`;
  }))).join("");
}

function statusClass(status) {
  return ({ "已完成": "done", "已簽署": "done", "待簽署": "warning", "採證中": "active", "已作廢": "danger" })[status] || "";
}

async function renderCaseForm(existing) {
  const emptyCase = {
    id: uuid(), name: "", reason: "違反毒品危害防制條例", suspect: "", unit: "", agencyName: "", address: "",
    suspectRole: "受搜索人", suspectGender: "", suspectBirthDate: "", suspectId: "",
    suspectRegisteredAddress: "", suspectResidence: "", suspectPresent: "是",
    searchLegalBasis: "出示搜索票", warrantNumber: "",
    addressCity: "臺北市", addressDistrict: "", addressRoad: "", addressCustomRoad: "",
    addressSection: "", addressLane: "", addressAlley: "", addressNumber: "", addressFloor: "", addressRoom: "", addressLocationNote: "",
    executionDate: nowIso(), searchStart: "", searchEnd: "", officer: "", recorder: "", tester: "", executors: "",
    presentPeople: "", notes: "", status: "草稿", createdAt: nowIso(), updatedAt: nowIso(), lockedAt: ""
  };
  let restoredDraft = null;
  if (!existing) {
    try { restoredDraft = JSON.parse(localStorage.getItem(CASE_DRAFT_KEY) || "null"); }
    catch { localStorage.removeItem(CASE_DRAFT_KEY); }
  }
  const data = existing || { ...emptyCase, ...(restoredDraft?.values || {}) };
  shell(`<form id="case-form" class="panel case-form">
    ${restoredDraft ? `<div class="draft-restored">已恢復 ${rocDateTime(restoredDraft.savedAt)} 的未完成草稿。<button type="button" id="discard-case-draft">清除草稿</button></div>` : ""}
    <div class="form-stepper" role="tablist" aria-label="案件資料步驟">
      ${["基本", "地址", "人員", "確認"].map((label, index) => `<button type="button" data-form-step="${index + 1}" class="${index === 0 ? "current" : ""}"><span>${index + 1}</span>${label}</button>`).join("")}
    </div>
    <section class="form-step form-grid current" data-step-panel="1">
      ${field("案件名稱", "name", data.name, true)}
      ${selectField("案由", "reason", ["違反毒品危害防制條例", "持有毒品", "販賣毒品", "施用毒品", "其他"], data.reason)}
      ${field("犯罪嫌疑人姓名", "suspect", data.suspect, true)}${field("執行單位", "unit", data.unit, true)}
      ${selectField("受執行人身分", "suspectRole", ["受搜索人", "扣押物所有人", "扣押物持有人", "扣押物保管人"], data.suspectRole)}
      ${selectField("性別", "suspectGender", ["", "男", "女", "其他"], data.suspectGender)}
      ${field("出生年月日", "suspectBirthDate", data.suspectBirthDate, false, "例如80年1月1日")}
      ${field("身分證統一編號", "suspectId", data.suspectId)}
      ${dateField("搜索開始時間", "searchStart", data.searchStart)}
      <div class="case-form-review"><strong>搜索結束時間</strong><p>完成現場搜索後，再到案件詳情按「結束搜索」記錄。</p></div>
    </section>
    <section class="form-step form-grid" data-step-panel="2">${addressFields(data)}</section>
    <section class="form-step form-grid" data-step-panel="3">
      ${field("機關全銜（文件標題）", "agencyName", data.agencyName, false, "例如內政部警政署航空警察局臺北分局")}
      ${field("承辦人", "officer", data.officer)}${field("製作筆錄人員", "recorder", data.recorder)}
      ${field("初驗人員", "tester", data.tester)}${field("執行人員", "executors", data.executors)}
      ${field("在場人員", "presentPeople", data.presentPeople)}
      ${field("受執行人戶籍地", "suspectRegisteredAddress", data.suspectRegisteredAddress)}
      ${field("受執行人現居所", "suspectResidence", data.suspectResidence)}
      ${selectField("受執行人是否在場", "suspectPresent", ["是", "否"], data.suspectPresent)}
    </section>
    <section class="form-step form-grid" data-step-panel="4">
      ${selectField("執行依據", "searchLegalBasis", ["出示搜索票", "附帶搜索", "緊急搜索", "逕行搜索", "同意搜索", "其他"], data.searchLegalBasis)}
      ${field("搜索票／核准字號", "warrantNumber", data.warrantNumber)}
      ${selectField("案件狀態", "status", statuses, data.status)}
      <label class="wide">備註<textarea name="notes" rows="3">${escapeHtml(data.notes)}</textarea></label>
      <div class="case-form-review wide"><strong>資料確認</strong><p>儲存後可新增證物、產生摘要及文件；所有資料均保存在此裝置。</p></div>
    </section>
    <div class="case-form-actions">
      <button type="button" id="case-step-previous">上一步</button>
      <span id="case-step-status">1 / 4</span>
      <button type="button" class="primary" id="case-step-next">下一步</button>
      <button class="primary hidden" id="case-save" type="submit">儲存案件</button>
    </div>
  </form>`, existing ? "修改案件資料" : "新增案件");
  bindAddressBuilder(data);
  bindCaseFormSteps();
  bindCaseDraft(existing);
  document.querySelector("#case-form").onsubmit = async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    if (!values.name.trim() || !values.suspect.trim() || !values.unit.trim() || !values.address.trim()) {
      return toast("請完成案件名稱、犯罪嫌疑人、執行單位與執行地址。", "錯誤");
    }
    const item = { ...data, ...values, searchStart: inputToIso(values.searchStart), searchEnd: data.searchEnd || "", updatedAt: nowIso() };
    await put("cases", item);
    localStorage.removeItem(CASE_DRAFT_KEY);
    toast("案件已儲存。");
    state.caseId = item.id;
    navigate("案件詳情", item.id);
  };
}

function bindCaseDraft(existing) {
  const form = document.querySelector("#case-form");
  form.querySelectorAll("input,select,textarea").forEach(control => {
    control.addEventListener("blur", () => control.classList.toggle("field-invalid", !control.checkValidity()));
    control.addEventListener("input", () => control.classList.remove("field-invalid"));
  });
  if (existing) return;
  let timer;
  const saveDraft = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const values = Object.fromEntries(new FormData(form));
      localStorage.setItem(CASE_DRAFT_KEY, JSON.stringify({ values, savedAt: nowIso() }));
      document.querySelector(".draft-save-status")?.remove();
      const status = document.createElement("span");
      status.className = "draft-save-status";
      status.textContent = "草稿已自動儲存";
      form.querySelector(".form-stepper").after(status);
    }, 350);
  };
  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);
  document.querySelector("#discard-case-draft")?.addEventListener("click", () => {
    if (!confirm("確定清除這份未完成草稿？")) return;
    localStorage.removeItem(CASE_DRAFT_KEY);
    renderCaseForm();
  });
}

function bindCaseFormSteps() {
  const form = document.querySelector("#case-form");
  const panels = [...form.querySelectorAll("[data-step-panel]")];
  const tabs = [...form.querySelectorAll("[data-form-step]")];
  const previous = form.querySelector("#case-step-previous");
  const next = form.querySelector("#case-step-next");
  const save = form.querySelector("#case-save");
  const status = form.querySelector("#case-step-status");
  let current = 1;
  const show = step => {
    current = Math.min(4, Math.max(1, step));
    panels.forEach(panel => panel.classList.toggle("current", Number(panel.dataset.stepPanel) === current));
    tabs.forEach(tab => {
      const tabStep = Number(tab.dataset.formStep);
      tab.classList.toggle("current", tabStep === current);
      tab.classList.toggle("complete", tabStep < current);
    });
    previous.disabled = current === 1;
    next.classList.toggle("hidden", current === 4);
    save.classList.toggle("hidden", current !== 4);
    status.textContent = `${current} / 4`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const currentIsValid = () => {
    const invalid = panels[current - 1].querySelector(":invalid");
    if (!invalid) return true;
    invalid.reportValidity();
    return false;
  };
  previous.onclick = () => show(current - 1);
  next.onclick = () => currentIsValid() && show(current + 1);
  tabs.forEach(tab => tab.onclick = () => {
    const target = Number(tab.dataset.formStep);
    if (target <= current || currentIsValid()) show(target);
  });
  show(1);
}

function addressFields(data) {
  const city = data.addressCity || "";
  const districts = ADDRESS_DATA[city]?.districts || [];
  const roads = ADDRESS_DATA[city]?.roads || [];
  return `<fieldset class="address-builder wide"><legend>執行地址</legend>
    <div class="address-primary">
      <label>縣市<em>必填</em><select name="addressCity" id="address-city"><option value="">請選擇</option>${CITIES.map(item => `<option ${item === city ? "selected" : ""}>${item}</option>`).join("")}</select></label>
      <label>行政區<em>必填</em><select name="addressDistrict" id="address-district"><option value="">請選擇</option>${districts.map(item => `<option ${item === data.addressDistrict ? "selected" : ""}>${item}</option>`).join("")}</select></label>
      <label>道路<em>必填</em><select name="addressRoad" id="address-road"><option value="">請選擇</option>${roads.map(item => `<option ${item === data.addressRoad ? "selected" : ""}>${item}</option>`).join("")}<option ${data.addressRoad === "其他道路" ? "selected" : ""}>其他道路</option></select></label>
      <label id="custom-road-field" class="${data.addressRoad === "其他道路" ? "" : "hidden"}">自訂道路<input name="addressCustomRoad" value="${escapeHtml(data.addressCustomRoad || "")}" placeholder="輸入道路或街名"></label>
    </div>
    <div class="address-details">
      ${addressPart("段", "addressSection", data.addressSection)}${addressPart("巷", "addressLane", data.addressLane)}
      ${addressPart("弄", "addressAlley", data.addressAlley)}${addressPart("號", "addressNumber", data.addressNumber)}
      ${addressPart("樓", "addressFloor", data.addressFloor)}${addressPart("室", "addressRoom", data.addressRoom)}
    </div>
    <label>無門牌地點或位置補充<input name="addressLocationNote" value="${escapeHtml(data.addressLocationNote || "")}" placeholder="例如河堤旁、停車場內"></label>
    <label>完整地址<input name="address" id="complete-address" value="${escapeHtml(data.address || "")}" readonly required></label>
  </fieldset>`;
}

function addressPart(label, name, value = "") {
  return `<label>${label}<input type="text" inputmode="numeric" name="${name}" value="${escapeHtml(value)}"></label>`;
}

function bindAddressBuilder(data) {
  const form = document.querySelector("#case-form");
  const city = form.querySelector("#address-city");
  const district = form.querySelector("#address-district");
  const road = form.querySelector("#address-road");
  const customRoadField = form.querySelector("#custom-road-field");
  const rebuildSelects = () => {
    const cityData = ADDRESS_DATA[city.value];
    district.innerHTML = `<option value="">請選擇</option>${(cityData?.districts || []).map(item => `<option>${item}</option>`).join("")}`;
    road.innerHTML = `<option value="">請選擇</option>${(cityData?.roads || []).map(item => `<option>${item}</option>`).join("")}<option>其他道路</option>`;
  };
  const updateAddress = () => {
    customRoadField.classList.toggle("hidden", road.value !== "其他道路");
    const formData = Object.fromEntries(new FormData(form));
    form.querySelector("#complete-address").value = composeAddress({
      city: formData.addressCity, district: formData.addressDistrict, road: formData.addressRoad,
      customRoad: formData.addressCustomRoad, section: formData.addressSection, lane: formData.addressLane,
      alley: formData.addressAlley, number: formData.addressNumber, floor: formData.addressFloor,
      room: formData.addressRoom, locationNote: formData.addressLocationNote
    }) || data.address || "";
  };
  city.onchange = () => { rebuildSelects(); updateAddress(); };
  form.querySelectorAll(".address-builder input,.address-builder select").forEach(element => element.addEventListener("change", updateAddress));
  form.querySelectorAll(".address-builder input").forEach(element => element.addEventListener("input", updateAddress));
  updateAddress();
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
    <p>${escapeHtml(caseData.reason)}</p><p>${escapeHtml(caseData.address)}</p></div>
    <div class="progress-ring"><strong>${completion}%</strong><span>採證完成度</span></div></section>
    <section class="search-timeline panel">
      <div><span>搜索開始</span><strong>${rocDateTime(caseData.searchStart)}</strong></div>
      <span class="timeline-arrow">→</span>
      <div><span>搜索結束</span><strong>${caseData.searchEnd ? rocDateTime(caseData.searchEnd) : "搜索進行中"}</strong></div>
      <div class="search-time-actions">
        ${!caseData.searchStart ? '<button class="primary" id="start-search">開始搜索</button>' : ""}
        ${caseData.searchStart && !caseData.searchEnd ? '<button class="primary" id="end-search">結束搜索</button>' : ""}
        ${caseData.searchStart ? '<button id="edit-search-time">修改時間</button>' : ""}
      </div>
    </section>
    <section class="action-row"><button id="edit-case">修改案件資料</button><button class="primary" id="add-evidence">新增證物</button>
      <button data-go="案件摘要">產生案件摘要</button><button data-go="文件中心">產生文件</button><button id="export-case">匯出完整案件</button></section>
    <section><div class="section-title"><h2>證物卡片</h2><span>${bundle.evidence.length} 件</span></div>
    <div class="evidence-list">${await evidenceCards(bundle.evidence)}</div></section>
    <section class="danger-zone"><h2>案件管理</h2><button id="lock-case">鎖定案件</button><button class="danger-button" id="void-case">作廢案件</button></section>`, "案件詳情");
  document.querySelector("#edit-case").onclick = () => renderCaseForm(caseData);
  document.querySelector("#add-evidence").onclick = () => createEvidence(caseData, bundle.evidence);
  document.querySelector("[data-go='案件摘要']").onclick = () => navigate("案件摘要");
  document.querySelector("[data-go='文件中心']").onclick = () => navigate("文件中心");
  document.querySelector("#start-search")?.addEventListener("click", async () => {
    if (!confirm("現在開始搜索並記錄時間？")) return;
    await put("cases", { ...caseData, searchStart: nowIso(), status: caseData.status === "草稿" ? "採證中" : caseData.status, updatedAt: nowIso() });
    toast("已記錄搜索開始時間。");
    renderCaseDetail();
  });
  document.querySelector("#end-search")?.addEventListener("click", async () => {
    const outstanding = bundle.evidence.flatMap(item =>
      validateEvidence(item, bundle.photos.filter(photo => photo.evidenceId === item.id)).map(issue => `${item.number}：${issue}`)
    );
    let exceptionReason = "";
    if (outstanding.length) {
      exceptionReason = prompt(`尚有 ${outstanding.length} 項缺漏：\n${outstanding.slice(0, 8).join("\n")}\n\n如仍需結束搜索，請輸入原因：`) || "";
      if (!exceptionReason.trim()) return toast("尚有缺漏項目，須填寫原因才能結束搜索。", "錯誤");
    } else if (!confirm("所有證物檢查完成。確定結束搜索並記錄現在時間？")) return;
    const endedAt = nowIso();
    await put("cases", { ...caseData, searchEnd: endedAt, searchEndExceptionReason: exceptionReason.trim(), updatedAt: endedAt });
    await put("audit", {
      id: uuid(), caseId: caseData.id, action: "結束搜索", entity: "cases", entityId: caseData.id,
      at: endedAt, issueCount: outstanding.length, reason: exceptionReason.trim()
    }, false);
    toast("已記錄搜索結束時間。");
    renderCaseDetail();
  });
  document.querySelector("#edit-search-time")?.addEventListener("click", async () => {
    const startValue = prompt("搜索開始時間（年-月-日 時:分）", localInputValue(caseData.searchStart).replace("T", " "));
    if (startValue === null) return;
    const endValue = prompt("搜索結束時間（尚未結束請留空）", localInputValue(caseData.searchEnd).replace("T", " "));
    if (endValue === null) return;
    const searchStart = inputToIso(startValue);
    const searchEnd = inputToIso(endValue);
    if (searchEnd && new Date(searchEnd) < new Date(searchStart)) return toast("搜索結束時間不得早於開始時間。", "錯誤");
    await put("cases", { ...caseData, searchStart, searchEnd, updatedAt: nowIso() });
    toast("搜索時間已更新。");
    renderCaseDetail();
  });
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
      <h3>${escapeHtml(item.name || "尚未填寫證物名稱")}</h3><p>${escapeHtml(item.evidenceCategory || "毒品")}｜${escapeHtml(item.drugType || item.appearance || "內容未填")}｜${escapeHtml(item.quantity || "0")}${escapeHtml(item.quantityUnit || "")}</p></div>
      <div>${checks.length ? `<span class="badge danger">缺漏 ${checks.length} 項</span><small>${escapeHtml(checks.slice(0, 2).join("、"))}</small>` : '<span class="badge done">採證完成</span>'}</div></button>`;
  }))).join("");
}

async function createEvidence(caseData, current, selectedCategory = "") {
  if (caseData.status === "已簽署" || caseData.status === "已作廢") return toast("已簽署或已作廢案件不得直接新增證物。", "錯誤");
  const evidenceCategory = selectedCategory || await chooseEvidenceCategory();
  if (!evidenceCategory) return;
  const sequence = current.length + 1;
  const prefix = localStorage.getItem("證物編號格式") || "證";
  const defaultName = evidenceCategory === "毒品" ? "疑似毒品" : evidenceCategory === "其他" ? "其他證物" : evidenceCategory;
  const defaultUnit = ({ "毒品": "包", "毒品施用器具": "組", "電子磅秤": "台", "手機": "支", "現金": "張", "包裝材料": "批", "其他": "件" })[evidenceCategory] || "件";
  const item = {
    id: uuid(), caseId: caseData.id, sequence, number: `${prefix}${chineseNumber(sequence)}`, evidenceCategory, name: defaultName,
    drugType: "", appearance: "", color: "", packaging: "", quantity: "", quantityUnit: defaultUnit,
    grossWeight: "", packageWeight: "", netWeight: "", weightUnit: "公克", foundAddress: caseData.address,
    space: "", exactLocation: "", positionExtra: "", locationText: "", foundAt: "", foundOriginalAt: "", foundTimeSource: "",
    reagent: "", testResult: "", reaction: "",
    brand: "", model: "", imei: "", phoneNumber: "", scaleResidue: "",
    utensilType: "", material: "", residue: "", denomination: "", billCount: "", cashTotal: "", categoryNote: "",
    testAt: "", testOriginalAt: "", testTimeSource: "", notes: "", status: "採證中", createdAt: nowIso(), updatedAt: nowIso()
  };
  await put("evidence", item);
  state.evidenceId = item.id; state.step = 1;
  navigate("證物採證", item.id);
}

function chooseEvidenceCategory() {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "evidence-category-dialog";
    dialog.innerHTML = `<form method="dialog">
      <div class="dialog-heading"><div><p class="eyebrow dark">新增證物</p><h2>請先選擇證物類別</h2></div></div>
      <label>證物類別<select id="new-evidence-category">${evidenceCategories.map(category => `<option>${category}</option>`).join("")}</select></label>
      <p class="field-note">非毒品證物不會強制要求秤重與毒品初驗資料。</p>
      <div class="dialog-actions"><button value="cancel">取消</button><button class="primary" id="confirm-evidence-category" value="default">開始採證</button></div>
    </form>`;
    document.body.append(dialog);
    let selected = "";
    dialog.querySelector("#confirm-evidence-category").onclick = () => {
      selected = dialog.querySelector("#new-evidence-category").value;
    };
    dialog.onclose = () => {
      dialog.remove();
      resolve(selected);
    };
    dialog.showModal();
  });
}

async function renderEvidenceWizard() {
  const evidence = await get("evidence", state.evidenceId);
  if (!evidence) return navigate("案件詳情", state.caseId);
  state.caseId = evidence.caseId;
  const caseData = await get("cases", evidence.caseId);
  const photos = (await byCase("photos", evidence.caseId)).filter(item => item.evidenceId === evidence.id);
  const isDrug = (evidence.evidenceCategory || "毒品") === "毒品";
  const stepNames = ["發現位置", "證物資料", isDrug ? "秤重" : "重量選填", isDrug ? "毒品初驗" : "初驗選填", "完整檢查"];
  shell(`<section class="wizard-head"><div><span class="evidence-number">${escapeHtml(evidence.number)}</span><h2>${escapeHtml(evidence.name)}</h2></div>
    <div class="stepper">${stepNames.map((name, index) => `<button class="${state.step === index + 1 ? "current" : state.step > index + 1 ? "complete" : ""}" data-step="${index + 1}"><span>${index + 1}</span><small>${name}</small></button>`).join("")}</div></section>
    <section id="wizard-content" class="panel">${await wizardStep(state.step, evidence, photos, caseData)}</section>
    <nav class="wizard-nav"><button type="button" id="previous-step" ${state.step === 1 ? "disabled" : ""}>上一步</button><button type="button" id="save-step">儲存</button>
      <button type="button" class="primary" id="next-step">${state.step === 5 ? "返回案件" : "確認並下一步"}</button></nav>`, "證物採證");
  bindWizard(evidence, photos, caseData);
}

async function wizardStep(step, evidence, photos, caseData) {
  const isDrug = (evidence.evidenceCategory || "毒品") === "毒品";
  if (step === 1) return photoStep("發現位置照片", photos, evidence, "foundAt", "查獲時間") + `
    <h3>發現位置快速組合</h3><div class="form-grid">${await optionSelect("空間位置", "space", evidence.space)}${await optionSelect("具體位置", "exactLocation", evidence.exactLocation)}
    ${await optionSelect("位置補充", "positionExtra", evidence.positionExtra)}<label class="wide">完整位置說明<textarea name="locationText">${escapeHtml(evidence.locationText)}</textarea></label></div>`;
  if (step === 2) return `<div class="form-grid">${field("證物編號", "number", evidence.number, true)}
    ${selectField("證物類別", "evidenceCategory", evidenceCategories, evidence.evidenceCategory || "毒品")}${field("證物名稱", "name", evidence.name, true)}
    ${isDrug ? await optionSelect("疑似毒品種類", "drugType", evidence.drugType) : ""}${await optionSelect("證物外觀", "appearance", evidence.appearance)}
    ${await optionSelect("顏色", "color", evidence.color)}${await optionSelect("包裝方式", "packaging", evidence.packaging)}
    ${evidence.evidenceCategory === "現金" ? "" : `<label>數量<div class="quick-values">${[1,2,3,4,5,10].map(value => `<button type="button" data-quantity="${value}">${value}</button>`).join("")}</div><input type="number" inputmode="numeric" min="1" name="quantity" value="${escapeHtml(evidence.quantity)}"></label>
    ${await optionSelect("數量單位", "quantityUnit", evidence.quantityUnit)}`}
    ${categorySpecificFields(evidence)}</div>`;
  if (step === 3) return `${isDrug ? "" : '<div class="notice"><strong>非毒品證物</strong><p>重量與秤重照片為選填，可直接前往下一步。</p></div>'}<div class="form-grid"><label>毛重${isDrug ? "<em>必填</em>" : ""}<input type="number" inputmode="decimal" min="0" step="0.01" name="grossWeight" value="${escapeHtml(evidence.grossWeight)}"></label>
    <label>包裝重量<input type="number" inputmode="decimal" min="0" step="0.01" name="packageWeight" value="${escapeHtml(evidence.packageWeight)}"></label>
    <label>淨重<input name="netWeight" value="${escapeHtml(evidence.netWeight)}" readonly></label>${await optionSelect("重量單位", "weightUnit", evidence.weightUnit)}</div>
    ${photoStep("秤重照片", photos)}`;
  if (step === 4) return `${isDrug ? "" : '<div class="notice"><strong>非毒品證物</strong><p>毒品初驗資料為選填，可直接進行完整檢查。</p></div>'}<div class="form-grid">${await optionSelect("初驗試劑", "reagent", evidence.reagent)}${await optionSelect("初驗結果", "testResult", evidence.testResult)}
    <label class="wide">反應情形<textarea name="reaction">${escapeHtml(evidence.reaction)}</textarea></label></div>${photoStep("初驗照片", photos, evidence, "testAt", "初驗時間")}`;
  const issues = validateEvidence(evidence, photos);
  return `<section class="completion ${issues.length ? "has-errors" : ""}"><div class="completion-mark">${issues.length ? "！" : "✓"}</div>
    <h2>${issues.length ? "尚有資料需要補齊" : "採證完成"}</h2>${issues.length ? `<div class="issue-jump-list">${issues.map(issue => `<button type="button" data-issue-step="${issueStep(issue)}">${escapeHtml(issue)}<span>前往修正 →</span></button>`).join("")}</div>` : "<p>照片、時間、重量與初驗資料皆已完成。</p>"}
    <div class="completion-actions"><button id="generate-captions">重新產生照片說明</button>${issues.length ? "" : '<button class="primary" id="add-next-evidence">完成並新增下一件</button>'}</div></section>`;
}

function issueStep(issue) {
  const match = String(issue).match(/^第([一二三四五])步/);
  return ({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 })[match?.[1]] || 1;
}

function categorySpecificFields(evidence) {
  const category = evidence.evidenceCategory || "毒品";
  if (category === "手機") return `${field("品牌", "brand", evidence.brand)}${field("型號", "model", evidence.model)}
    ${field("IMEI", "imei", evidence.imei, false, "可於設定或機身標示查詢")}${field("門號", "phoneNumber", evidence.phoneNumber)}`;
  if (category === "電子磅秤") return `${field("品牌", "brand", evidence.brand)}${field("型號", "model", evidence.model)}
    ${field("秤面殘留情形", "scaleResidue", evidence.scaleResidue, false, "例如白色粉末殘留")}`;
  if (category === "毒品施用器具") return `${field("器具種類", "utensilType", evidence.utensilType, false, "例如吸食器、針筒")}
    ${field("材質", "material", evidence.material)}${field("殘留情形", "residue", evidence.residue)}`;
  if (category === "現金") return `<label>面額<input type="number" inputmode="numeric" min="0" name="denomination" value="${escapeHtml(evidence.denomination)}"></label>
    <label>張數<input type="number" inputmode="numeric" min="0" name="billCount" value="${escapeHtml(evidence.billCount)}"></label>
    <label>總額<input name="cashTotal" value="${escapeHtml(evidence.cashTotal)}" readonly></label>`;
  if (category === "包裝材料") return `${field("材質", "material", evidence.material)}${field("殘留情形", "residue", evidence.residue)}`;
  if (category === "其他") return `<label class="wide">類別補充<textarea name="categoryNote">${escapeHtml(evidence.categoryNote)}</textarea></label>`;
  return "";
}

async function optionSelect(category, name, value) {
  const options = (await getAll("options")).filter(item => item.category === category && item.enabled)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.favorite) - Number(a.favorite) || b.useCount - a.useCount || a.order - b.order);
  const names = options.map(item => item.name);
  const extra = value && !names.includes(value) ? `<option selected>${escapeHtml(value)}</option>` : "";
  return `<label>${category}<select name="${name}"><option value="">請選擇</option>${extra}${options.map(item => `<option value="${escapeHtml(item.name)}" ${item.name === value ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}</select></label>`;
}

function photoStep(type, photos, evidence, timeKey, label) {
  const photo = photos.find(item => item.type === type);
  const source = photo && (photo.preview || photo.original);
  const sourceUrl = source instanceof Blob ? URL.createObjectURL(source) : source;
  return `<section class="photo-capture"><h2>${type}</h2>${photo ? `<div class="photo-preview"><img src="${sourceUrl}" alt="${type}">
    <div><strong>${escapeHtml(photo.fileName)}</strong><span>${Math.round(photo.size / 1024)} 千位元組</span><span>摘要：${photo.hash.slice(0, 16)}…</span>
    <button type="button" class="danger-button" data-delete-photo="${photo.id}">刪除照片</button></div></div>` : `<div class="camera-placeholder">尚未拍攝</div>`}
    <div class="photo-source-actions">
      <label class="photo-source-button camera-button">${photo ? "重新拍照" : "直接拍照"}<input type="file" accept="image/*" capture="environment" data-photo-type="${type}"></label>
      <label class="photo-source-button album-button">${photo ? "從相簿更換" : "從相簿選擇"}<input type="file" accept="image/*" data-photo-type="${type}"></label>
    </div>
    ${timeKey ? `<div class="time-card"><strong>${label}</strong><span>${rocDateTime(evidence[timeKey])}</span><small>時間來源：${escapeHtml(evidence[timeKey.replace("At", "TimeSource")] || "尚未取得")}</small>
    <div class="time-actions"><button type="button" data-time-now="${timeKey}">使用現在時間</button><button type="button" data-time-edit="${timeKey}">手動修改</button><button type="button" data-time-clear="${timeKey}">清除時間</button></div></div>` : ""}</section>`;
}

function bindWizard(evidence, photos, caseData) {
  const runWizardAction = async (button, task) => {
    if (button.dataset.busy === "true") return;
    const navButtons = [...document.querySelectorAll(".wizard-nav button")];
    button.dataset.busy = "true";
    setButtonBusy(button, "儲存中…");
    navButtons.filter(item => item !== button).forEach(item => item.disabled = true);
    try {
      await task();
    } catch (error) {
      toast(`無法儲存證物：${error.message}`, "錯誤");
      restoreButton(button);
      navButtons.forEach(item => item.disabled = item.id === "previous-step" && state.step === 1);
      delete button.dataset.busy;
    }
  };
  document.querySelectorAll("[data-step]").forEach(button => button.onclick = async () => {
    const previousStep = state.step;
    try {
      const saved = await saveWizard(evidence);
      if (!saved) return;
      state.step = Number(button.dataset.step);
      await renderEvidenceWizard();
    } catch (error) {
      state.step = previousStep;
      toast(`無法切換步驟：${error.message}`, "錯誤");
    }
  });
  document.querySelector("#previous-step").onclick = event => runWizardAction(event.currentTarget, async () => {
    const saved = await saveWizard(evidence);
    if (!saved) throw new Error("請先修正目前資料。");
    const previousStep = state.step;
    state.step -= 1;
    try { await renderEvidenceWizard(); }
    catch (error) { state.step = previousStep; throw error; }
  });
  document.querySelector("#save-step").onclick = event => runWizardAction(event.currentTarget, async () => {
    const saved = await saveWizard(evidence);
    if (!saved) throw new Error("請先修正目前資料。");
    toast("本步驟已儲存。");
    restoreButton(event.currentTarget);
    document.querySelectorAll(".wizard-nav button").forEach(item => item.disabled = item.id === "previous-step" && state.step === 1);
    delete event.currentTarget.dataset.busy;
  });
  document.querySelector("#next-step").onclick = async () => {
    const button = document.querySelector("#next-step");
    await runWizardAction(button, async () => {
      const saved = await saveWizard(evidence);
      if (!saved) throw new Error("請先修正目前資料。");
      if (state.step === 5) return navigate("案件詳情", evidence.caseId);
      const previousStep = state.step;
      state.step += 1;
      try { await renderEvidenceWizard(); }
      catch (error) { state.step = previousStep; throw error; }
    });
  };
  document.querySelectorAll("[data-quantity]").forEach(button => button.onclick = () => {
    document.querySelector("[name='quantity']").value = button.dataset.quantity;
    document.querySelector("[name='quantity']").dispatchEvent(new Event("change"));
  });
  document.querySelector("[name='evidenceCategory']")?.addEventListener("change", async event => {
    const name = document.querySelector("[name='name']");
    const previousCategory = evidence.evidenceCategory || "毒品";
    if (!name.value || name.value === "疑似毒品" || name.value === previousCategory) {
      name.value = event.target.value === "毒品" ? "疑似毒品" : event.target.value;
    }
    await saveWizard(evidence);
    renderEvidenceWizard();
  });
  const updateCashTotal = () => {
    const denomination = Number(document.querySelector("[name='denomination']")?.value || 0);
    const billCount = Number(document.querySelector("[name='billCount']")?.value || 0);
    const total = document.querySelector("[name='cashTotal']");
    if (total) total.value = denomination && billCount ? String(denomination * billCount) : "";
  };
  document.querySelectorAll("[name='denomination'],[name='billCount']").forEach(input => input?.addEventListener("input", updateCashTotal));
  document.querySelectorAll("[name='grossWeight'],[name='packageWeight']").forEach(input => input?.addEventListener("input", () => {
    try { document.querySelector("[name='netWeight']").value = calculateNet(document.querySelector("[name='grossWeight']").value, document.querySelector("[name='packageWeight']").value); }
    catch (error) { toast(error.message, "錯誤"); }
  }));
  document.querySelectorAll("[data-photo-type]").forEach(input => input.onchange = event => addPhoto(event.target.files[0], event.target.dataset.photoType, evidence, photos));
  document.querySelectorAll("[data-delete-photo]").forEach(button => button.onclick = async () => {
    const photo = photos.find(item => item.id === button.dataset.deletePhoto);
    if (!photo) return;
    const reason = prompt("請輸入刪除照片原因：")?.trim();
    if (!reason) return toast("必須填寫刪除原因。", "錯誤");
    await put("audit", {
      id: uuid(), caseId: evidence.caseId, action: "刪除照片", entity: "photos", entityId: photo.id,
      evidenceId: evidence.id, photoType: photo.type, previousHash: photo.hash, reason, at: nowIso()
    }, false);
    await remove("photos", photo.id, evidence.caseId);
    const timeKey = ({ "發現位置照片": "foundAt", "初驗照片": "testAt" })[photo.type];
    if (timeKey) await put("evidence", { ...evidence, [timeKey]: "", [timeKey.replace("At", "TimeSource")]: "", updatedAt: nowIso() });
    toast("照片已刪除並留下稽核紀錄。");
    renderEvidenceWizard();
  });
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
  document.querySelectorAll("[data-issue-step]").forEach(button => button.onclick = async () => {
    await saveWizard(evidence);
    state.step = Number(button.dataset.issueStep);
    renderEvidenceWizard();
  });
  document.querySelector("#add-next-evidence")?.addEventListener("click", async () => {
    const saved = await saveWizard(evidence);
    if (!saved) return;
    const current = await byCase("evidence", evidence.caseId);
    await createEvidence(caseData, current);
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
  let replacementReason = "";
  if (old) {
    replacementReason = prompt("請輸入重新拍攝或更換照片的原因：")?.trim() || "";
    if (!replacementReason) return toast("更換照片必須填寫原因。", "錯誤");
  }
  const photo = {
    id: old?.id || uuid(), caseId: evidence.caseId, evidenceId: evidence.id, type, original: file, preview,
    fileName: file.name || `${type}.jpg`, mime: file.type, size: file.size, width: preview.width, height: preview.height,
    originalAt: finalAt, importedAt, finalAt, timeSource, caption: old?.caption || "", hash, order: ({ "發現位置照片": 1, "秤重照片": 2, "初驗照片": 3 })[type] || 4,
    createdAt: old?.createdAt || importedAt,
    replacementHistory: old ? [...(old.replacementHistory || []), {
      previousHash: old.hash, previousFileName: old.fileName, replacedAt: importedAt, reason: replacementReason
    }] : []
  };
  photo.caption = photo.caption || photoCaption(evidence, type, photo.order);
  if (old) await put("audit", {
    id: uuid(), caseId: evidence.caseId, action: "重拍取代照片", entity: "photos", entityId: old.id,
    evidenceId: evidence.id, photoType: type, previousHash: old.hash, newHash: hash,
    reason: replacementReason, at: importedAt
  }, false);
  await put("photos", photo);
  const map = { "發現位置照片": "foundAt", "初驗照片": "testAt" };
  const key = map[type];
  const timeFields = key ? { [key]: finalAt, [key.replace("At", "OriginalAt")]: finalAt, [key.replace("At", "TimeSource")]: timeSource } : {};
  await put("evidence", { ...evidence, ...timeFields, updatedAt: nowIso() });
  toast(key ? "照片已保存，並依照片時間自動帶入。" : "秤重照片已保存。"); renderEvidenceWizard();
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
  const isDrug = (item.evidenceCategory || "毒品") === "毒品";
  if (!item.number) issues.push("第二步：證物編號未填");
  if (!item.name) issues.push("第二步：證物名稱未填");
  if (!has("發現位置照片")) issues.push("第一步：缺少發現位置照片");
  if (!item.foundAt) issues.push("第一步：缺少查獲時間");
  if (!item.locationText) issues.push("第一步：缺少查獲位置");
  if (item.evidenceCategory !== "現金" && !item.quantity) issues.push("第二步：缺少數量");
  if (item.evidenceCategory === "現金" && !item.denomination) issues.push("第二步：缺少現金面額");
  if (item.evidenceCategory === "現金" && !item.billCount) issues.push("第二步：缺少現金張數");
  if (isDrug && !item.grossWeight) issues.push("第三步：缺少毛重");
  if (isDrug && !has("秤重照片")) issues.push("第三步：缺少秤重照片");
  if (isDrug && item.testResult && item.testResult !== "未實施初驗" && !item.reagent) issues.push("第四步：有初驗結果但未選初驗試劑");
  if (isDrug && item.testResult && item.testResult !== "未實施初驗" && !has("初驗照片")) issues.push("第四步：有初驗結果但缺少初驗照片");
  if (has("初驗照片") && !item.testAt) issues.push("第四步：有初驗照片但缺少初驗時間");
  return issues;
}

async function getSummaryTemplateOption() {
  const options = await getAll("options");
  return options.find(item => item.category === "摘要範本") || null;
}

async function renderCaseSummary() {
  const caseData = await get("cases", state.caseId);
  if (!caseData) return navigate("案件列表");
  const evidence = await byCase("evidence", caseData.id);
  const templateOption = await getSummaryTemplateOption();
  const template = templateOption?.name || DEFAULT_SUMMARY_TEMPLATE;
  const summary = renderSummary(template, caseData, evidence);
  const values = summaryValues(caseData, evidence);
  shell(`<section class="panel summary-panel">
    <div class="section-title"><div><p class="eyebrow dark">依案件固定欄位自動產生</p><h2>案件摘要</h2></div><span class="badge active">自動產生</span></div>
    <blockquote id="generated-summary">${escapeHtml(summary)}</blockquote>
    <div class="action-row"><button class="primary" id="copy-summary">複製摘要</button><button id="download-summary">匯出文字檔</button><button id="edit-summary-template">修改摘要範本</button></div>
  </section>
  <section class="panel"><h2>本次帶入資料</h2><div class="summary-values">${Object.entries(values).map(([key, value]) =>
    `<div><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value)}</span></div>`).join("")}</div>
    <p class="field-note">以上內容來自案件及證物固定欄位。如需變更，請返回案件或證物採證頁修改原始資料。</p>
  </section>
  <dialog id="summary-template-dialog"><form method="dialog" id="summary-template-form">
    <div class="dialog-heading"><h2>修改摘要範本</h2><button value="cancel" aria-label="關閉">關閉</button></div>
    <p>可修改固定文字；系統欄位請保留雙大括號。產生摘要時會自動代入案件資料。</p>
    <label>摘要範本<textarea id="summary-template-text" rows="8">${escapeHtml(template)}</textarea></label>
    <div class="template-fields"><strong>可用固定欄位</strong>${SUMMARY_FIELDS.map(field => `<button type="button" data-summary-field="${field}">{{${field}}}</button>`).join("")}</div>
    <p id="template-error" class="error-text" role="alert"></p>
    <div class="dialog-actions"><button value="cancel">取消</button><button type="button" class="primary" id="save-summary-template">儲存範本</button></div>
  </form></dialog>`, "案件摘要");
  document.querySelector("#copy-summary").onclick = async () => {
    try { await navigator.clipboard.writeText(summary); toast("案件摘要已複製。"); }
    catch { toast("瀏覽器無法直接複製，請長按摘要文字後選擇複製。", "錯誤"); }
  };
  document.querySelector("#download-summary").onclick = () =>
    downloadBlob(new Blob([summary], { type: "text/plain;charset=utf-8" }), `${caseData.name || "案件"}_摘要.txt`);
  const dialog = document.querySelector("#summary-template-dialog");
  document.querySelector("#edit-summary-template").onclick = () => dialog.showModal();
  document.querySelectorAll("[data-summary-field]").forEach(button => button.onclick = () => {
    const textarea = document.querySelector("#summary-template-text");
    textarea.setRangeText(`{{${button.dataset.summaryField}}}`, textarea.selectionStart, textarea.selectionEnd, "end");
    textarea.focus();
  });
  document.querySelector("#save-summary-template").onclick = async () => {
    const newTemplate = document.querySelector("#summary-template-text").value.trim();
    const unknown = unknownSummaryFields(newTemplate);
    const error = document.querySelector("#template-error");
    if (!newTemplate) { error.textContent = "摘要範本不得空白。"; return; }
    if (unknown.length) { error.textContent = `找不到固定欄位：${unknown.join("、")}。請修正或使用下方欄位按鈕。`; return; }
    const now = nowIso();
    await put("options", {
      ...(templateOption || { id: uuid(), category: "摘要範本", useCount: 0, lastUsedAt: "", order: 0, pinned: true, favorite: true, isDefault: true, builtIn: true, enabled: true, createdAt: now }),
      name: newTemplate, updatedAt: now
    });
    dialog.close();
    toast("摘要範本已儲存。");
    renderCaseSummary();
  };
}

async function renderDocuments() {
  const caseData = await get("cases", state.caseId);
  const { evidence, photos, documents } = await collectCase(state.caseId);
  const content = generateDocument(state.documentType, caseData, evidence, photos);
  shell(`<label class="document-picker">文件種類<select id="document-type">${documentTypes.map(type => `<option ${type === state.documentType ? "selected" : ""}>${type}</option>`).join("")}</select></label>
    <section class="document-actions"><button id="regenerate">重新產生</button><button id="editable-export">匯出可修改文件</button><button id="print-document">列印</button><button id="pdf-export">匯出 PDF</button><button class="primary" data-go="簽署">進入簽署流程</button></section>
    <section class="document-preview">${content}</section>`, "文件中心");
  document.querySelector("#document-type").onchange = event => { state.documentType = event.target.value; renderDocuments(); };
  document.querySelector("#regenerate").onclick = async () => {
    const button = document.querySelector("#regenerate");
    setButtonBusy(button, "產生中…");
    try {
      const html = wrapDocument(content); const hash = await documentHash(html);
      const current = documents.filter(item => item.type === state.documentType);
      await put("documents", { id: uuid(), caseId: caseData.id, type: state.documentType, version: current.length + 1, status: "工作稿", content: html, hash, createdAt: nowIso() });
      toast("已建立新的文件版本。");
    } catch (error) {
      toast(`文件產生失敗：${error.message}`, "錯誤");
    } finally {
      restoreButton(button);
    }
  };
  document.querySelector("#editable-export").onclick = () => downloadBlob(new Blob([wrapDocument(content)], { type: "application/msword" }), `${state.documentType}_未簽署工作稿.doc`);
  document.querySelector("#print-document").onclick = () => openPrintDocument(content, false);
  document.querySelector("#pdf-export").onclick = () => openPrintDocument(content, true);
  document.querySelector("[data-go='簽署']").onclick = () => navigate("簽署");
}

function setButtonBusy(button, label) {
  button.dataset.originalLabel = button.textContent;
  button.textContent = label;
  button.disabled = true;
  button.classList.add("is-loading");
}

function restoreButton(button) {
  button.textContent = button.dataset.originalLabel || button.textContent;
  button.disabled = false;
  button.classList.remove("is-loading");
}

function openPrintDocument(content, pdfMode) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return toast("瀏覽器阻擋了列印視窗，請允許彈出式視窗後重試。", "錯誤");
  printWindow.document.write(wrapDocument(content));
  printWindow.document.close();
  printWindow.onload = () => {
    if (pdfMode) toast("已開啟列印畫面：電腦請選擇「另存為 PDF」；iPhone 可由預覽的分享按鈕儲存 PDF。");
    printWindow.focus();
    printWindow.print();
  };
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
  const caseCount = (await getAll("cases")).length;
  shell(`<section class="menu-grid data-menu"><button id="backup-all"><strong>匯出全部案件備份</strong><small>包含案件、照片、文件、簽名及設定</small></button>
    <label class="file-card"><strong>還原全部案件</strong><small>匯入證跡備份檔；可選擇合併或取代</small><input id="restore-all" type="file" accept=".json,application/json"></label>
    <label class="file-card"><strong>匯入單一案件備份</strong><small>重複案件識別碼將停止匯入</small><input id="restore-case" type="file" accept=".json,application/json"></label>
    <button id="export-options"><strong>匯出預設選項</strong><small>另存常用選項、人員及地址</small></button></section>
    <section class="panel"><h2>安全提醒</h2><p>備份檔可能包含個人資料、照片與簽名。請存放於受控裝置，不要傳送到未經授權的雲端服務。</p></section>
    <section class="panel app-maintenance"><div><h2>系統維護</h2><p>重新整理不會刪除資料；清除暫存只會移除證跡的離線網頁快取，不會清除案件、照片、文件、簽名或常用設定。</p></div>
      <div class="maintenance-actions"><button id="reload-app">重新整理系統</button><button id="clear-app-cache">清除暫存並重新整理</button></div></section>
    <section class="panel clear-cases-panel"><div><h2>清除全部案件</h2><p>目前共有 <strong>${caseCount}</strong> 件。只會清除案件、證物、照片、文件、簽名與稽核紀錄；常用選項、人員及地址設定會保留。</p></div>
      <button class="danger-button" id="clear-all-cases" ${caseCount ? "" : "disabled"}>一鍵清除案件</button></section>
    <section class="panel version-history"><div class="section-title"><h2>更新紀錄</h2><span class="badge active">v${APP_VERSION}</span></div>
      ${CHANGELOG.map(release => `<details ${release.version === APP_VERSION ? "open" : ""}><summary>v${release.version}｜${release.date}</summary><ul>${release.changes.map(change => `<li>${escapeHtml(change)}</li>`).join("")}</ul></details>`).join("")}
    </section>`, "備份與還原");
  document.querySelector("#backup-all").onclick = exportAllBackup;
  document.querySelector("#restore-all").onchange = async event => restoreFile(event.target.files[0], true);
  document.querySelector("#restore-case").onchange = async event => restoreFile(event.target.files[0], false);
  document.querySelector("#export-options").onclick = async () => {
    const data = { version: 1, options: await getAll("options"), addresses: await getAll("addresses"), people: await getAll("people") };
    downloadBlob(new Blob([JSON.stringify(data)], { type: "application/json" }), "證跡_常用資料.json");
  };
  document.querySelector("#reload-app").onclick = () => location.reload();
  document.querySelector("#clear-app-cache").onclick = async event => {
    if (!confirm("確定清除證跡的離線暫存並重新整理？案件及所有正式資料都會保留。")) return;
    const button = event.currentTarget;
    setButtonBusy(button, "清除中…");
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
      location.replace(`${location.pathname}?refresh=${Date.now()}`);
    } catch (error) {
      restoreButton(button);
      toast(`無法清除暫存：${error.message}`, "錯誤");
    }
  };
  document.querySelector("#clear-all-cases").onclick = async () => {
    if (!confirm(`即將永久清除本裝置內 ${caseCount} 件案件及其證物、照片、文件與簽名。建議先匯出完整備份。是否繼續？`)) return;
    if (!confirm("最後確認：清除後無法復原，確定清除全部案件？")) return;
    try {
      await clearAllCaseData();
      localStorage.removeItem(CASE_DRAFT_KEY);
      state.caseId = "";
      state.evidenceId = "";
      toast(`已清除 ${caseCount} 件案件；常用選項、人員及地址設定已保留。`);
      await renderDataManager();
    } catch (error) {
      toast(`無法清除案件：${error.message}`, "錯誤");
    }
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
