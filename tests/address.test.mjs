import test from "node:test";
import assert from "node:assert/strict";
import { ADDRESS_DATA, composeAddress } from "../src/address.js";

test("臺北市及新北市行政區選項完整", () => {
  assert.equal(ADDRESS_DATA["臺北市"].districts.length, 12);
  assert.equal(ADDRESS_DATA["新北市"].districts.length, 29);
});

test("地址依選項自動組合", () => {
  assert.equal(composeAddress({
    city: "臺北市", district: "中正區", road: "中山南路",
    section: "1", lane: "2", alley: "3", number: "4", floor: "5", room: "6"
  }), "臺北市中正區中山南路1段2巷3弄4號5樓6室");
});

test("其他道路使用自訂道路名稱", () => {
  assert.equal(composeAddress({
    city: "新北市", district: "板橋區", road: "其他道路", customRoad: "測試街", number: "8"
  }), "新北市板橋區測試街8號");
});
