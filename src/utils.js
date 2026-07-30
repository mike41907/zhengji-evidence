export const uuid = () => crypto.randomUUID();

export function nowIso() {
  return new Date().toISOString();
}

export function rocDateTime(value) {
  if (!value) return "尚未設定";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "時間格式錯誤";
  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value ?? "00";
  return `${Number(get("year")) - 1911}年${get("month")}月${get("day")}日${get("hour")}時${get("minute")}分${get("second")}秒`;
}

export function rocDate(value) {
  if (!value) return "尚未設定";
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const get = type => parts.find(part => part.type === type)?.value ?? "00";
  return `${Number(get("year")) - 1911}年${get("month")}月${get("day")}日`;
}

export function localInputValue(value) {
  if (!value) return "";
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

export function inputToIso(value) {
  return value ? new Date(value).toISOString() : "";
}

export function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

export async function sha256(data) {
  const buffer = data instanceof Blob ? await data.arrayBuffer() :
    new TextEncoder().encode(typeof data === "string" ? data : JSON.stringify(data));
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function safeFileName(value) {
  return String(value || "未命名").replace(/[\\/:*?"<>|]/g, "＿").trim();
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = safeFileName(fileName);
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export const chineseNumber = number => {
  const digits = "零一二三四五六七八九";
  if (number <= 10) return number === 10 ? "十" : digits[number];
  if (number < 20) return `十${digits[number % 10]}`;
  if (number < 100) return `${digits[Math.floor(number / 10)]}十${number % 10 ? digits[number % 10] : ""}`;
  return String(number);
};

export function cloneEvidenceSettings(source, { id, caseId, sequence, number, timestamp }) {
  return {
    ...source,
    id,
    caseId,
    sequence,
    number,
    quantity: "",
    grossWeight: "",
    packageWeight: "",
    netWeight: "",
    foundAt: "",
    foundOriginalAt: "",
    foundTimeSource: "",
    testAt: "",
    testOriginalAt: "",
    testTimeSource: "",
    testResult: "",
    reaction: "",
    imei: "",
    phoneNumber: "",
    billCount: "",
    cashTotal: "",
    notes: "",
    status: "採證中",
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function evidenceLocationDefaults(items = []) {
  const latest = [...items].sort((a, b) =>
    (b.sequence || 0) - (a.sequence || 0) ||
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  )[0];
  if (!latest) return {};
  return {
    foundAddress: latest.foundAddress || "",
    space: latest.space || "",
    exactLocation: latest.exactLocation || "",
    positionExtra: latest.positionExtra || "",
    locationText: latest.locationText || ""
  };
}

export function adjacentEvidenceStep(current, category, direction = 1) {
  const steps = category === "毒品" ? [1, 2, 3, 4, 5] : [1, 2, 5];
  const index = steps.indexOf(Number(current));
  if (index < 0) return steps[0];
  return steps[Math.min(steps.length - 1, Math.max(0, index + direction))];
}

export function toast(message, type = "成功") {
  const old = document.querySelector(".toast");
  old?.remove();
  const element = document.createElement("div");
  element.className = `toast ${type === "錯誤" ? "error" : ""}`;
  element.textContent = message;
  document.body.append(element);
  setTimeout(() => element.remove(), 3200);
}
