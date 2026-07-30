import test from "node:test";
import assert from "node:assert/strict";
import { generateDocument, wrapDocument } from "../src/documents.js";

test("扣押物品目錄表符合正式欄位與最少十一列", () => {
  const html = generateDocument("扣押物品目錄表", {
    agencyName: "內政部警政署航空警察局臺北分局",
    unit: "本分局偵查隊"
  }, [{
    evidenceCategory: "手機", name: "手機", brand: "Apple", model: "iPhone",
    imei: "1234567890", quantity: "1", quantityUnit: "支"
  }], []);
  assert.match(html, /內政部警政署航空警察局臺北分局扣押物品目錄表/);
  assert.match(html, /所有人／持有<br>人／保管人/);
  assert.match(html, /IMEI：1234567890/);
  assert.match(html, /（可視實際需要增列）/);
  assert.equal((html.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr/g) || []).length, 11);
});

test("搜索扣押筆錄產生三頁正式範本", () => {
  const html = generateDocument("搜索扣押筆錄", {
    agencyName: "彰化縣警察局彰化分局", suspect: "王小明", suspectRole: "受搜索人",
    searchLegalBasis: "出示搜索票", warrantNumber: "115年度聲搜字第1號",
    address: "彰化縣彰化市測試路1號", searchStart: "2026-07-30T01:00:00Z",
    searchEnd: "2026-07-30T02:00:00Z", executors: "陳員警", recorder: "林員警"
  }, [{ evidenceCategory: "手機", name: "手機", quantity: "1", quantityUnit: "支" }], []);
  assert.match(html, /附錄一、搜索筆錄範本/);
  assert.match(html, /執行之依據/);
  assert.match(html, /執行時告知事項/);
  assert.match(html, /執行經過情形/);
  assert.match(html, /受執行人簽名捺印/);
  assert.equal((html.match(/search-record-page/g) || []).length, 3);
});

test("列印文件使用 A4 PDF 版面與正式文件樣式", () => {
  const html = wrapDocument('<article class="document search-record-page">內容</article>');
  assert.match(html, /@page\{size:A4 portrait;margin:12mm\}/);
  assert.match(html, /\.search-record-page/);
  assert.match(html, /\.seizure-inventory/);
  assert.match(html, /break-after:page/);
});
