import test from "node:test";
import assert from "node:assert/strict";
import { evidenceSummary, renderSummary, unknownSummaryFields } from "../src/summary.js";

const caseData = {
  caseNumber: "刑一字第一號",
  name: "測試案件",
  reason: "持有毒品",
  unit: "本分局偵查隊",
  searchStart: "2026-07-30T01:02:03Z",
  address: "臺北市測試路一號",
  suspect: "王小明",
  officer: "李員警"
};
const evidence = [{
  number: "證一", name: "疑似毒品", drugType: "甲基安非他命",
  quantity: "1", quantityUnit: "包", netWeight: "9.25", grossWeight: "10.00", weightUnit: "公克"
}];

test("摘要固定欄位會代入案件與證物資料", () => {
  const summary = renderSummary("{{執行單位}}於{{執行時間}}查獲{{犯罪嫌疑人}}持有{{毒品明細}}。", caseData, evidence);
  assert.match(summary, /本分局偵查隊於115年07月30日/);
  assert.match(summary, /王小明/);
  assert.match(summary, /甲基安非他命/);
  assert.match(summary, /毛重10.00公克/);
});

test("毒品明細使用含包裝毛重", () => {
  assert.match(evidenceSummary(evidence), /毛重10.00公克/);
  assert.doesNotMatch(evidenceSummary(evidence), /9.25公克/);
});
test("非毒品證物不會顯示重量未填", () => {
  const summary = evidenceSummary([{
    number: "證二", evidenceCategory: "手機", name: "iPhone 手機",
    quantity: "1", quantityUnit: "支", grossWeight: "", netWeight: ""
  }]);
  assert.match(summary, /證二iPhone 手機共1支/);
  assert.doesNotMatch(summary, /重量未填/);
});
test("現金證物摘要會顯示總額", () => {
  const summary = evidenceSummary([{
    number: "證三", evidenceCategory: "現金", name: "現金",
    denomination: "1000", billCount: "3", cashTotal: "3000"
  }]);
  assert.match(summary, /總額3000元/);
});
test("未知摘要欄位會被攔截", () => assert.deepEqual(unknownSummaryFields("{{執行單位}}{{不存在欄位}}"), ["不存在欄位"]));
