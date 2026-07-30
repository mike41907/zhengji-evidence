import { byCase, exportDatabase } from "./db.js";
import { downloadBlob, nowIso, rocDate, safeFileName, sha256 } from "./utils.js";
import { generateDocument, wrapDocument } from "./documents.js";

export async function exportCase(caseData, evidence, photos, documents, signatures) {
  if (!window.JSZip) throw new Error("壓縮元件尚未載入。");
  const zip = new window.JSZip();
  const draftFolder = zip.folder("一、未簽署工作稿");
  const previewFolder = zip.folder("二、文件預覽");
  const signedFolder = zip.folder("三、正式簽署文件");
  const photoFolder = zip.folder("四、原始照片");
  const dataFolder = zip.folder("五、案件資料");
  const integrityFolder = zip.folder("六、完整性資料");
  const manifest = [];
  const types = ["搜索扣押筆錄", "毒品初步檢驗紀錄表", "證物照片紀錄", "扣押物品目錄表"];
  for (const type of types) {
    const html = wrapDocument(generateDocument(type, caseData, evidence, photos));
    draftFolder.file(`${type}_未簽署工作稿.doc`, html);
    previewFolder.file(`${type}_文件預覽.html`, html);
    manifest.push({ file: `一、未簽署工作稿/${type}_未簽署工作稿.doc`, hash: await sha256(html) });
  }
  for (const document of documents.filter(item => item.status === "已簽署")) {
    signedFolder.file(`${document.type}_第${document.version}版_正式文件.html`, document.content);
    manifest.push({ file: `三、正式簽署文件/${document.type}_第${document.version}版_正式文件.html`, hash: document.hash });
  }
  let photoIndex = 0;
  for (const photo of photos) {
    photoIndex += 1;
    const evidenceItem = evidence.find(item => item.id === photo.evidenceId);
    const extension = (photo.fileName || "").split(".").pop() || "jpg";
    const fileName = `${evidenceItem?.number || "未編號"}_第${photoIndex}張_${photo.type}.${extension}`;
    photoFolder.file(safeFileName(fileName), photo.original);
    manifest.push({ file: `四、原始照片/${fileName}`, hash: photo.hash });
  }
  dataFolder.file("案件資料.json", JSON.stringify({ case: caseData, evidence, signatures, documents: documents.map(({ content, ...rest }) => rest) }, null, 2));
  integrityFolder.file("匯出清冊.json", JSON.stringify({
    exportAt: nowIso(), caseId: caseData.id, documentVersion: 1,
    photoCount: photos.length, evidenceCount: evidence.length,
    signedDocumentCount: documents.filter(item => item.status === "已簽署").length, files: manifest
  }, null, 2));
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  downloadBlob(blob, `${caseData.name}_${rocDate(nowIso())}.zip`);
}

export async function exportAllBackup() {
  const data = await exportDatabase();
  downloadBlob(new Blob([JSON.stringify(data)], { type: "application/json" }), `證跡_全部資料備份_${rocDate(nowIso())}.json`);
}

export async function collectCase(caseId) {
  const [evidence, photos, documents, signatures, audit] = await Promise.all([
    byCase("evidence", caseId), byCase("photos", caseId), byCase("documents", caseId),
    byCase("signatures", caseId), byCase("audit", caseId)
  ]);
  photos.sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  return { evidence, photos, documents, signatures, audit };
}
