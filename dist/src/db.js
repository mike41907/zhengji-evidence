import { nowIso, uuid } from "./utils.js";

const DATABASE_NAME = "證跡第一版資料庫";
const DATABASE_VERSION = 1;
const STORES = ["cases", "evidence", "photos", "options", "addresses", "people", "documents", "signatures", "audit"];
let connection;

export function openDatabase() {
  if (connection) return connection;
  connection = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: "id" });
          if (["evidence", "photos", "documents", "signatures", "audit"].includes(name)) {
            store.createIndex("caseId", "caseId", { unique: false });
          }
          if (name === "photos") store.createIndex("evidenceId", "evidenceId", { unique: false });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return connection;
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  const db = await openDatabase();
  return requestPromise(db.transaction(storeName).objectStore(storeName).getAll());
}

export async function get(storeName, id) {
  const db = await openDatabase();
  return requestPromise(db.transaction(storeName).objectStore(storeName).get(id));
}

export async function put(storeName, value, audit = true) {
  const db = await openDatabase();
  await requestPromise(db.transaction(storeName, "readwrite").objectStore(storeName).put(value));
  if (audit && storeName !== "audit") {
    await put("audit", {
      id: uuid(), caseId: value.caseId || (storeName === "cases" ? value.id : ""),
      action: "儲存", entity: storeName, entityId: value.id, at: nowIso()
    }, false);
  }
  return value;
}

export async function remove(storeName, id, caseId = "") {
  const db = await openDatabase();
  await requestPromise(db.transaction(storeName, "readwrite").objectStore(storeName).delete(id));
  await put("audit", { id: uuid(), caseId, action: "刪除", entity: storeName, entityId: id, at: nowIso() }, false);
}

export async function byCase(storeName, caseId) {
  const db = await openDatabase();
  const store = db.transaction(storeName).objectStore(storeName);
  if (!store.indexNames.contains("caseId")) return [];
  return requestPromise(store.index("caseId").getAll(caseId));
}

export async function clearStore(storeName) {
  const db = await openDatabase();
  return requestPromise(db.transaction(storeName, "readwrite").objectStore(storeName).clear());
}

export async function seedDefaults() {
  if ((await getAll("options")).length) return;
  const groups = {
    "摘要範本": ["{{執行單位}}於{{執行時間}}在{{執行地址}}查獲犯罪嫌疑人{{犯罪嫌疑人}}，現場查獲{{毒品明細}}。"],
    "案由": ["違反毒品危害防制條例", "持有毒品", "販賣毒品", "施用毒品"],
    "疑似毒品種類": ["甲基安非他命", "愷他命", "海洛因", "大麻", "依托咪酯", "毒品咖啡包", "不明粉末", "不明結晶", "不明錠劑", "不明液體", "其他"],
    "證物外觀": ["白色結晶", "透明結晶", "白色粉末", "褐色粉末", "綠色植物碎片", "錠劑", "膠囊", "液體", "菸草狀物", "咖啡包", "其他"],
    "顏色": ["白色", "透明", "褐色", "黃色", "綠色", "黑色", "混合色", "其他"],
    "包裝方式": ["夾鏈袋", "塑膠袋", "真空包裝", "紙袋", "藥袋", "玻璃罐", "塑膠罐", "鋁箔包", "咖啡包裝", "散裝", "其他"],
    "數量單位": ["包", "袋", "顆", "錠", "瓶", "罐", "支", "盒", "件", "其他"],
    "重量單位": ["公克", "毫克", "公斤", "其他"],
    "初驗結果": ["呈陽性反應", "呈陰性反應", "反應不明顯", "未實施初驗", "待送鑑定"],
    "初驗試劑": ["甲基安非他命初驗試劑", "愷他命初驗試劑", "海洛因初驗試劑", "大麻初驗試劑", "依托咪酯初驗試劑", "其他"],
    "空間位置": ["客廳", "主臥室", "次臥室", "廚房", "浴室", "陽臺", "書房", "儲藏室", "車內", "身上", "隨身物品", "包裹內", "行李內", "其他"],
    "具體位置": ["桌面", "桌下", "抽屜內", "衣櫃內", "床頭櫃內", "床墊下", "枕頭下", "沙發上", "沙發下", "冰箱內", "包包內", "外套口袋", "褲子口袋", "駕駛座", "副駕駛座", "中央扶手", "車門置物槽", "後車廂", "紙箱內", "保險箱內", "其他"],
    "位置補充": ["左側", "右側", "上層", "中層", "下層", "第一格", "第二格", "第三格", "第一層抽屜", "第二層抽屜", "第三層抽屜", "最內側", "最外側", "其他"]
  };
  let order = 0;
  for (const [category, values] of Object.entries(groups)) {
    for (const name of values) {
      await put("options", {
        id: uuid(), category, name, useCount: 0, lastUsedAt: "", order: order++,
        pinned: false, favorite: false, isDefault: values.indexOf(name) === 0,
        builtIn: true, enabled: true, createdAt: nowIso(), updatedAt: nowIso()
      }, false);
    }
  }
}

export async function exportDatabase() {
  const data = { version: 1, exportedAt: nowIso(), stores: {} };
  for (const store of STORES) data.stores[store] = await getAll(store);
  return data;
}

export async function importDatabase(data, replace = false) {
  if (!data || data.version !== 1 || !data.stores) throw new Error("備份格式或版本不相容。");
  if (replace) for (const store of STORES) await clearStore(store);
  for (const store of STORES) {
    for (const item of data.stores[store] || []) await put(store, item, false);
  }
}

export { STORES };
