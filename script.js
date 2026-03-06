// ================================
// 文書起案システム（区分切替 + 稟議添付）
// submit / list / update
// ================================

// ★設定
const SPREADSHEET_ID = "1JKlTIoES5N53T_VDM0vz9nyPAZV7R00hQOMHfN9c-1E";
const SHEET_NAME = "data";
const SAVE_FOLDER_ID = "1s10EghEv_lel1otKvcYEd7Q_Gv_q9sgk"; // 空でもOK（マイドライブ直下）
const APPROVER_PIN = "1234"; // 承認者PIN（approve.html用）

// ---- 共有ユーティリティ ----
function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function nowJst_() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function safeStr_(v) {
  return String(v ?? "").trim();
}

function ensureColumn_(sh, colName) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const header = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  if (header.indexOf(colName) === -1) {
    sh.getRange(1, lastCol + 1).setValue(colName);
  }
}

function sheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);

  // ヘッダが無ければ作る
  if (sh.getLastRow() === 0) {
    sh.appendRow([
      "kianId",
      "createdAt",
      "type",
      "typeLabel",
      "seiriNo",       // ★追加
      "title",
      "content",
      "kou",
      "moku",
      "setsu",
      "amount",
      "payee",
      "payer",
      "method",
      "attachmentUrl",
      "status",
      "approvalsJson",
      "approverA",
      "approvedAtA",
      "commentA",
      "approverB",
      "approvedAtB",
      "commentB"
    ]);
  } else {
    // 既存シート用：必要列を自動追加
    [
      "seiriNo",
      "approverA",
      "approvedAtA",
      "commentA",
      "approverB",
      "approvedAtB",
      "commentB"
    ].forEach(name => ensureColumn_(sh, name));
  }

  return sh;
}

function headerIndex_(sh) {
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = {};
  header.forEach((name, i) => { idx[name] = i + 1; });
  return idx;
}

function findRowByKianId_(sh, kianId, colKianId) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const values = sh.getRange(2, colKianId, last - 1, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0]) === kianId) return i + 2;
  }
  return -1;
}

function makeKianId_() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const base =
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `${base}-${rand}`;
}

function saveAttachment_(att, kianId) {
  if (!att || !att.dataUrl) return "";

  const match = String(att.dataUrl).match(/^data:(.+?);base64,(.+)$/);
  if (!match) return "";

  const mimeType = match[1] || "application/octet-stream";
  const b64 = match[2];
  const bytes = Utilities.base64Decode(b64);
  const blob = Utilities.newBlob(bytes, mimeType, att.fileName || `attachment_${kianId}`);

  let folder;
  if (SAVE_FOLDER_ID && SAVE_FOLDER_ID.trim() !== "") {
    folder = DriveApp.getFolderById(SAVE_FOLDER_ID.trim());
  } else {
    folder = DriveApp.getRootFolder();
  }

  const file = folder.createFile(blob);
  file.setName(`${kianId}_${file.getName()}`);
  return file.getUrl();
}

// ================================================
// doGet
// ================================================
function doGet() {
  return json_({ ok: true, msg: "alive", at: nowJst_() });
}

// ================================================
// doPost
// ================================================
function doPost(e) {
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : "{}");
    const action = safeStr_(req.action || "submit").toLowerCase();

    if (action === "submit")  return json_(submit_(req));
    if (action === "list")    return json_(list_(req));
    if (action === "approve") return json_(approve_(req));

    return json_({ ok: false, message: "unknown action: " + action });
  } catch (err) {
    return json_({ ok: false, message: String(err) });
  }
}

// ================================================
// submit
// ================================================
function submit_(req) {
  const type = safeStr_(req.type);
  const typeLabel = safeStr_(req.label);
  const seiriNo = safeStr_(req.seiriNo);   // ★追加

  const title = safeStr_(req.title);
  const content = safeStr_(req.content);
  if (!title) return { ok: false, message: "title required" };
  if (!content) return { ok: false, message: "content required" };
  if (!seiriNo) return { ok: false, message: "seiriNo required" }; // ★追加

  const kou = safeStr_(req.kou);
  const moku = safeStr_(req.moku);
  const setsu = safeStr_(req.setsu);

  const amount = safeStr_(req.amount);
  const payee  = safeStr_(req.payee);
  const payer  = safeStr_(req.payer);
  const method = safeStr_(req.method);

  let attachmentUrl = "";
  if (req.attachment) {
    attachmentUrl = saveAttachment_(req.attachment, "TMP");
  }

  const sh = sheet_();
  const idx = headerIndex_(sh);

  const kianId = makeKianId_();
  const createdAt = nowJst_();

  if (req.attachment) {
    attachmentUrl = saveAttachment_(req.attachment, kianId);
  }

  const row = [];
  row[idx["kianId"] - 1] = kianId;
  row[idx["createdAt"] - 1] = createdAt;
  row[idx["type"] - 1] = type;
  row[idx["typeLabel"] - 1] = typeLabel;
  row[idx["seiriNo"] - 1] = seiriNo;   // ★追加
  row[idx["title"] - 1] = title;
  row[idx["content"] - 1] = content;
  row[idx["kou"] - 1] = kou;
  row[idx["moku"] - 1] = moku;
  row[idx["setsu"] - 1] = setsu;
  row[idx["amount"] - 1] = amount;
  row[idx["payee"] - 1] = payee;
  row[idx["payer"] - 1] = payer;
  row[idx["method"] - 1] = method;
  row[idx["attachmentUrl"] - 1] = attachmentUrl;
  row[idx["status"] - 1] = "pending";
  row[idx["approvalsJson"] - 1] = "[]";

  sh.appendRow(row);

  return { ok: true, kianId, seiriNo, fileUrl: attachmentUrl || "" };
}

// ================================================
// list
// ================================================
function list_(req) {
  const wantStatus = safeStr_(req.status || "pending");
  const limit = Number(req.limit || 50);

  const sh = sheet_();
  const idx = headerIndex_(sh);

  const last = sh.getLastRow();
  if (last < 2) return { ok: true, items: [] };

  const values = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  const items = [];

  for (const row of values) {
    const status = String(row[idx["status"] - 1] || "pending");
    if (status !== wantStatus) continue;

    let approvals = [];
    try { approvals = JSON.parse(String(row[idx["approvalsJson"] - 1] || "[]")); }
    catch (e) { approvals = []; }

    items.push({
      kianId: row[idx["kianId"] - 1],
      createdAt: row[idx["createdAt"] - 1],
      type: row[idx["type"] - 1],
      typeLabel: row[idx["typeLabel"] - 1],
      seiriNo: idx["seiriNo"] ? row[idx["seiriNo"] - 1] : "",   // ★追加
      title: row[idx["title"] - 1],
      content: row[idx["content"] - 1],
      amount: row[idx["amount"] - 1],
      payee: row[idx["payee"] - 1],
      payer: row[idx["payer"] - 1],
      method: row[idx["method"] - 1],
      attachmentUrl: row[idx["attachmentUrl"] - 1],
      approvals
    });
  }

  items.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  return { ok: true, items: items.slice(0, limit) };
}

// ================================================
// approve
// ================================================
function approve_(req) {
  const kianId = safeStr_(req.kianId);
  const name = safeStr_(req.approverName);
  const comment = safeStr_(req.comment);
  const at = safeStr_(req.at) || nowJst_();
  const side = safeStr_(req.side).toUpperCase();

  if (!kianId) return { ok: false, message: "kianId required" };
  if (!name) return { ok: false, message: "approverName required" };
  if (side !== "A" && side !== "B") return { ok: false, message: "side must be A or B" };

  const sh = sheet_();
  const idx = headerIndex_(sh);

  const need = ["kianId","status","approverA","approvedAtA","commentA","approverB","approvedAtB","commentB"];
  const missing = need.filter(k => !idx[k]);
  if (missing.length) return { ok:false, message:"missing columns: " + missing.join(", ") };

  const rowNo = findRowByKianId_(sh, kianId, idx["kianId"]);
  if (rowNo === -1) return { ok: false, message: "kianId not found: " + kianId };

  const aName = safeStr_(sh.getRange(rowNo, idx["approverA"]).getValue());
  const bName = safeStr_(sh.getRange(rowNo, idx["approverB"]).getValue());
  if ((side === "A" && bName === name) || (side === "B" && aName === name)) {
    return { ok:false, message:"同じ名前がA/B両方に入っています。別の承認者名にしてください。" };
  }

  if (side === "A") {
    if (aName) return { ok:false, message:"承認Aは既に入力済みです（" + aName + "）" };
    sh.getRange(rowNo, idx["approverA"]).setValue(name);
    sh.getRange(rowNo, idx["approvedAtA"]).setValue(at);
    sh.getRange(rowNo, idx["commentA"]).setValue(comment);
  } else {
    if (bName) return { ok:false, message:"承認Bは既に入力済みです（" + bName + "）" };
    sh.getRange(rowNo, idx["approverB"]).setValue(name);
    sh.getRange(rowNo, idx["approvedAtB"]).setValue(at);
    sh.getRange(rowNo, idx["commentB"]).setValue(comment);
  }

  const newA = safeStr_(sh.getRange(rowNo, idx["approverA"]).getValue());
  const newB = safeStr_(sh.getRange(rowNo, idx["approverB"]).getValue());
  const status = (newA && newB) ? "approved" : "pending";
  sh.getRange(rowNo, idx["status"]).setValue(status);

  return { ok:true, status, approverA:newA, approverB:newB };
}
