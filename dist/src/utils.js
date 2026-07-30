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

export function calculateNet(gross, packageWeight) {
  if (gross === "" || gross == null || packageWeight === "" || packageWeight == null) return "";
  const grossNumber = Number(gross);
  const packageNumber = Number(packageWeight);
  if (!Number.isFinite(grossNumber) || !Number.isFinite(packageNumber) || grossNumber < 0 || packageNumber < 0) {
    throw new Error("重量必須是零或正數。");
  }
  if (grossNumber < packageNumber) throw new Error("毛重不得小於包裝重量，請修正後再儲存。");
  return (grossNumber - packageNumber).toFixed(2);
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
