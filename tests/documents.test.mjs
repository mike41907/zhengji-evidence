import test from "node:test";
import assert from "node:assert/strict";
import { generateDocument } from "../src/documents.js";

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
