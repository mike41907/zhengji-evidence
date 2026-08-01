import test from "node:test";
import assert from "node:assert/strict";
import { generateDocument, photoCaption, preparePrintDocument, wrapDocument } from "../src/documents.js";

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
    agencyName: "彰化縣警察局彰化分局", suspect: "王小明", suspectRole: "受搜索人", suspectBirthDate: "1991-01-02",
    searchLegalBasis: "出示搜索票", warrantNumber: "115年度聲搜字第1號",
    address: "彰化縣彰化市測試路1號", searchStart: "2026-07-30T01:00:00Z",
    searchEnd: "2026-07-30T02:00:00Z", executors: "陳員警", recorder: "林員警"
  }, [{ evidenceCategory: "手機", name: "手機", quantity: "1", quantityUnit: "支" }], []);
  assert.match(html, /搜索筆錄/);
  assert.match(html, /扣押筆錄/);
  assert.match(html, /執行之依據/);
  assert.match(html, /執行時告知事項/);
  assert.match(html, /執行經過情形/);
  assert.match(html, /受執行人簽名捺印/);
  assert.match(html, /80年01月02日/);
  assert.equal((html.match(/search-record-template-page/g) || []).length, 3);
  assert.equal((html.match(/search-record-template-image/g) || []).length, 3);
  assert.match(html, /page-01\.webp/);
  assert.match(html, /page-02\.webp/);
  assert.match(html, /page-03\.webp/);
});

test("列印文件使用 A4 PDF 版面與正式文件樣式", () => {
  const html = wrapDocument(preparePrintDocument('<article class="document search-record-page">內容</article>'));
  assert.match(html, /@page\{size:A4 portrait;margin:0\}/);
  assert.match(html, /\.search-record-page/);
  assert.match(html, /\.seizure-inventory/);
  assert.match(html, /break-after:page/);
  assert.match(html, /Kaiti TC/);
  assert.match(html, /第1頁，共1頁/);
  assert.match(html, /\.print-navigation\{display:none!important\}/);
});

test("搜索扣押筆錄簽名帶入受執行人欄位", () => {
  const signature = "data:image/png;base64,TEST_SIGNATURE";
  const html = generateDocument("搜索扣押筆錄", {
    unit: "測試單位", suspect: "王小明", suspectRole: "受搜索人"
  }, [], [], { signed: true, signature, signerName: "王小明" });
  assert.match(html, /class="search-record-signer"/);
  assert.equal((html.match(/data:image\/png;base64,TEST_SIGNATURE/g) || []).length, 3);
  assert.match(html, /width:38mm;height:16mm/);
});

test("搜索扣押筆錄列印固定為三頁並加入中文頁碼", () => {
  const content = generateDocument("搜索扣押筆錄", { agencyName: "內政部警政署航空警察局臺北分局" }, [], []);
  const html = preparePrintDocument(content);
  assert.match(html, /第1頁，共3頁/);
  assert.match(html, /第2頁，共3頁/);
  assert.match(html, /第3頁，共3頁/);
  assert.equal((html.match(/document-page-number/g) || []).length, 4);
});

test("毒品文件與照片說明只使用含包裝毛重", () => {
  const evidence = {
    number: "證一", evidenceCategory: "毒品", name: "疑似毒品", quantity: "1", quantityUnit: "包",
    grossWeight: "10.25", packageWeight: "1.00", netWeight: "9.25", weightUnit: "公克"
  };
  const html = generateDocument("毒品初步鑑驗報告單", { suspect: "王小明" }, [evidence], []);
  assert.match(html, /毛重10\.25公克/);
  assert.doesNotMatch(html, /包裝重量/);
  assert.doesNotMatch(html, /淨重/);
  assert.match(photoCaption(evidence, "秤重照片"), /連同包裝.*毛重10.25公克/);
});

test("正確的毒品初步鑑驗報告單會整合多筆毒品證物", () => {
  const html = generateDocument("毒品初步鑑驗報告單", {
    agencyName: "內政部警政署航空警察局臺北分局",
    unit: "偵查隊",
    suspect: "王小明",
    tester: "偵查佐 測試員",
    address: "臺北市測試區"
  }, [{
    evidenceCategory: "毒品",
    number: "證物一",
    drugType: "疑似第二級毒品安非他命",
    quantity: "1",
    quantityUnit: "包",
    grossWeight: "32.92",
    weightUnit: "公克",
    foundAt: "2026-07-21T02:00:00Z",
    testAt: "2026-07-21T02:25:00Z",
    reagent: "拉曼光譜檢測儀",
    testResult: "呈安非他命反應"
  }, {
    evidenceCategory: "毒品",
    number: "證物二",
    drugType: "疑似第二級毒品安非他命",
    quantity: "1",
    quantityUnit: "包",
    grossWeight: "1.04",
    weightUnit: "公克"
  }], []);
  assert.match(html, /毒品初步鑑驗報告單/);
  assert.match(html, /案類/);
  assert.match(html, /☑安非他命/);
  assert.match(html, /一、扣押物目錄編號：證物一/);
  assert.match(html, /二、扣押物目錄編號：證物二/);
  assert.match(html, /毛重32\.92公克/);
  assert.match(html, /涉嫌人簽章/);
});

test("搜索扣押筆錄採用原始機關標題及完整告知內容", () => {
  const html = generateDocument("搜索扣押筆錄", {
    agencyName: "內政部警政署航空警察局臺北分局",
    suspectRole: "犯罪嫌疑人",
    searchLegalBasis: "附帶扣押"
  }, [], []);
  assert.doesNotMatch(html, /<h1>搜索扣押筆錄<\/h1>/);
  assert.match(html, /內政部警政署航空警察局臺北分局/);
  assert.match(html, /執行理由：涉嫌 毒品危害防制條例 案/);
  assert.doesNotMatch(html, /☑/);
  assert.match(html, /犯罪嫌疑人/);
  assert.match(html, /page-02\.webp/);
  assert.match(html, /有開啟鎖扃、封緘或為其他必要之處分/);
  assert.match(html, /刑事訴訟法第一百三十七條執行附帶扣押/);
  assert.doesNotMatch(html, /附錄一、搜索筆錄範本/);
});

test("所有正式文件使用標楷體且標題維持單行", () => {
  const caseData = { agencyName: "內政部警政署航空警察局臺北分局", suspect: "王小明" };
  const drug = generateDocument("毒品初步鑑驗報告單", caseData, [], []);
  const inventory = generateDocument("扣押物品目錄表", caseData, [], []);
  const photos = generateDocument("證物照片紀錄", caseData, [], []);
  assert.match(wrapDocument(photos), /標楷體/);
  assert.match(drug, /white-space:nowrap/);
  assert.doesNotMatch(drug, /條例<br>毒品初步鑑驗報告單/);
  assert.match(inventory, /<h1 style="white-space:nowrap;/);
});
