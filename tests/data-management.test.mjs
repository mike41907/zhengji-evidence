import test from "node:test";
import assert from "node:assert/strict";
import { CASE_DATA_STORES, deleteCaseData, deleteEvidenceData, permanentlyDeleteTrash, purgeExpiredTrash, restoreCaseData } from "../src/db.js";

test("一鍵清除案件只涵蓋案件相關資料", () => {
  assert.deepEqual(CASE_DATA_STORES, [
    "cases", "evidence", "photos", "documents", "signatures", "audit", "trash"
  ]);
  assert.equal(CASE_DATA_STORES.includes("options"), false);
  assert.equal(CASE_DATA_STORES.includes("addresses"), false);
  assert.equal(CASE_DATA_STORES.includes("people"), false);
});

test("提供案件及證物關聯資料刪除流程", () => {
  assert.equal(typeof deleteCaseData, "function");
  assert.equal(typeof deleteEvidenceData, "function");
  assert.equal(typeof restoreCaseData, "function");
  assert.equal(typeof permanentlyDeleteTrash, "function");
  assert.equal(typeof purgeExpiredTrash, "function");
});
