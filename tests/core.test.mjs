import test from "node:test";
import assert from "node:assert/strict";
import { calculateNet, chineseNumber, rocDateTime, safeFileName } from "../src/utils.js";
test("民國日期時間格式一致", () => assert.match(rocDateTime("2026-07-29T04:05:06Z"), /^\d{3}年\d{2}月\d{2}日\d{2}時\d{2}分\d{2}秒$/));
test("淨重正確計算到小數二位", () => assert.equal(calculateNet("10.50", "1.25"), "9.25"));
test("毛重小於包裝重量時拒絕", () => assert.throws(() => calculateNet("1", "2"), /毛重不得小於包裝重量/));
test("中文序號正確", () => { assert.equal(chineseNumber(1), "一"); assert.equal(chineseNumber(12), "十二"); assert.equal(chineseNumber(20), "二十"); });
test("檔名會移除不允許字元", () => assert.equal(safeFileName('案:號/一?'), "案＿號＿一＿"));
