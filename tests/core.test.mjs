import test from "node:test";
import assert from "node:assert/strict";
import { calculateNet, chineseNumber, cloneEvidenceSettings, rocDateTime, safeFileName } from "../src/utils.js";
test("民國日期時間格式一致", () => assert.match(rocDateTime("2026-07-29T04:05:06Z"), /^\d{3}年\d{2}月\d{2}日\d{2}時\d{2}分\d{2}秒$/));
test("淨重正確計算到小數二位", () => assert.equal(calculateNet("10.50", "1.25"), "9.25"));
test("毛重小於包裝重量時拒絕", () => assert.throws(() => calculateNet("1", "2"), /毛重不得小於包裝重量/));
test("中文序號正確", () => { assert.equal(chineseNumber(1), "一"); assert.equal(chineseNumber(12), "十二"); assert.equal(chineseNumber(20), "二十"); });
test("檔名會移除不允許字元", () => assert.equal(safeFileName('案:號/一?'), "案＿號＿一＿"));
test("複製證物設定不會帶入個別採證資料", () => {
  const copy = cloneEvidenceSettings({
    id: "old", caseId: "case-1", sequence: 1, number: "證一", evidenceCategory: "手機",
    name: "iPhone", appearance: "黑色", quantity: "1", quantityUnit: "支",
    foundAt: "2026-07-31T01:00:00Z", testAt: "2026-07-31T02:00:00Z",
    grossWeight: "10", packageWeight: "1", netWeight: "9",
    imei: "123456", phoneNumber: "0900000000", testResult: "陽性", notes: "個別備註"
  }, { id: "new", caseId: "case-1", sequence: 2, number: "證二", timestamp: "2026-07-31T03:00:00Z" });
  assert.equal(copy.name, "iPhone");
  assert.equal(copy.appearance, "黑色");
  assert.equal(copy.quantityUnit, "支");
  assert.equal(copy.id, "new");
  assert.equal(copy.number, "證二");
  for (const key of ["quantity", "foundAt", "testAt", "grossWeight", "packageWeight", "netWeight", "imei", "phoneNumber", "testResult", "notes"]) {
    assert.equal(copy[key], "");
  }
});
