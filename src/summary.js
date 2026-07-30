import { rocDateTime } from "./utils.js";

export const DEFAULT_SUMMARY_TEMPLATE = "{{執行單位}}於{{執行時間}}在{{執行地址}}查獲犯罪嫌疑人{{犯罪嫌疑人}}，現場查獲{{毒品明細}}。";

export const SUMMARY_FIELDS = [
  "案件名稱", "案由", "執行單位", "執行時間",
  "執行地址", "犯罪嫌疑人", "承辦人", "毒品明細", "證物數量"
];

export function evidenceSummary(evidenceList) {
  if (!evidenceList.length) return "尚無證物資料";
  return evidenceList.map(item => {
    const name = item.drugType || item.name || "未填證物";
    const weight = item.netWeight || item.grossWeight;
    const weightText = weight ? `${weight}${item.weightUnit || "公克"}` : "重量未填";
    const quantityText = item.quantity ? `${item.quantity}${item.quantityUnit || ""}` : "";
    return `${item.number || "未編號"}${name}${quantityText ? `共${quantityText}` : ""}、${weightText}`;
  }).join("；");
}

export function summaryValues(caseData, evidenceList) {
  return {
    "案件名稱": caseData.name || "案件名稱未填",
    "案由": caseData.reason || "案由未填",
    "執行單位": caseData.unit || "執行單位未填",
    "執行時間": rocDateTime(caseData.searchStart || caseData.executionDate || caseData.createdAt),
    "執行地址": caseData.address || "執行地址未填",
    "犯罪嫌疑人": caseData.suspect || "犯罪嫌疑人未填",
    "承辦人": caseData.officer || "承辦人未填",
    "毒品明細": evidenceSummary(evidenceList),
    "證物數量": `${evidenceList.length}件`
  };
}

export function renderSummary(template, caseData, evidenceList) {
  const values = summaryValues(caseData, evidenceList);
  return String(template || DEFAULT_SUMMARY_TEMPLATE).replace(/\{\{([^{}]+)\}\}/g, (match, field) =>
    Object.hasOwn(values, field.trim()) ? values[field.trim()] : match
  );
}

export function unknownSummaryFields(template) {
  const unknown = [];
  for (const match of String(template).matchAll(/\{\{([^{}]+)\}\}/g)) {
    const field = match[1].trim();
    if (!SUMMARY_FIELDS.includes(field) && !unknown.includes(field)) unknown.push(field);
  }
  return unknown;
}
