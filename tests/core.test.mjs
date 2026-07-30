import test from "node:test";
import assert from "node:assert/strict";
import { adjacentEvidenceStep, chineseNumber, cloneEvidenceSettings, dateInputValue, evidenceLocationDefaults, rocDate, rocDateTime, safeFileName } from "../src/utils.js";
test("民國日期時間格式一致", () => assert.match(rocDateTime("2026-07-29T04:05:06Z"), /^\d{3}年\d{2}月\d{2}日\d{2}時\d{2}分\d{2}秒$/));
test("日期選擇器支援舊民國日期並輸出正式格式", () => {
  assert.equal(dateInputValue("80年1月2日"), "1991-01-02");
  assert.equal(dateInputValue("1991-01-02"), "1991-01-02");
  assert.equal(rocDate("1991-01-02"), "80年01月02日");
});
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

test("新增下一件證物會沿用最近一件的發現位置", () => {
  const defaults = evidenceLocationDefaults([
    { sequence: 1, space: "客廳", exactLocation: "桌面", locationText: "舊位置" },
    { sequence: 2, space: "臥室", exactLocation: "床頭櫃", positionExtra: "抽屜內", locationText: "於上址臥室床頭櫃抽屜內發現。" }
  ]);
  assert.equal(defaults.space, "臥室");
  assert.equal(defaults.exactLocation, "床頭櫃");
  assert.equal(defaults.locationText, "於上址臥室床頭櫃抽屜內發現。");
});

test("非毒品證物略過秤重與毒品初驗步驟", () => {
  assert.equal(adjacentEvidenceStep(2, "手機", 1), 5);
  assert.equal(adjacentEvidenceStep(5, "手機", -1), 2);
  assert.equal(adjacentEvidenceStep(2, "毒品", 1), 3);
});
