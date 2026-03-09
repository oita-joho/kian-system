// ================================
// script.js
// 配置変更版
// ================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbxO2DbK4xqe3KDBBtM1XlAF2TBInF8iXHAHPGuod0-sDv8I12RfjZqcZeOKmDwY7-Sbzg/exec";

function $(id) {
  return document.getElementById(id);
}

function v(id) {
  return ($(id)?.value || "").trim();
}

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

let selectedFiles = [];
let draftItemsCache = [];
let pendingItemsCache = [];
let returnedItemsCache = [];
let approvedItemsCache = [];

// ================================
// 共通欄 → hidden同期
// ================================
function syncCommonToHiddenFields() {
  const type = $("type")?.value || "";
  const title = v("commonTitle");
  const writer = v("commonWriter");
  const content = v("commonContent");

  if (type === "shishutsu") {
    if ($("s_title")) $("s_title").value = title;
    if ($("s_writer")) $("s_writer").value = writer;
    if ($("s_content")) $("s_content").value = content;
  } else if (type === "shuunyuu") {
    if ($("r_title")) $("r_title").value = title;
    if ($("r_writer")) $("r_writer").value = writer;
    if ($("r_content")) $("r_content").value = content;
  } else if (type === "ringi") {
    if ($("g_title")) $("g_title").value = title;
    if ($("g_writer")) $("g_writer").value = writer;
    if ($("g_content")) $("g_content").value = content;
  }
}

// ================================
// UI切替
// ================================
function applyTypeUI() {
  const t = $("type")?.value || "";
  const after = $("afterTypeFields");
  const rowKms = $("rowKms");
  const rowMoney = $("rowMoney");

  if (after) after.style.display = t ? "" : "none";

  const isRingi = (t === "ringi");

  if (rowKms) rowKms.style.display = isRingi ? "none" : "";
  if (rowMoney) rowMoney.style.display = isRingi ? "none" : "";

  const labelAmount = $("labelAmount");
  const labelPartner = $("labelPartner");
  const labelMethod = $("labelMethod");
  const labelDate = $("labelDate");

  if (t === "shishutsu") {
    if (labelAmount) labelAmount.textContent = "支払金額";
    if (labelPartner) labelPartner.textContent = "支払先";
    if (labelMethod) labelMethod.textContent = "支払方法";
    if (labelDate) labelDate.textContent = "支出年月日";
  } else if (t === "shuunyuu") {
    if (labelAmount) labelAmount.textContent = "収入金額";
    if (labelPartner) labelPartner.textContent = "納入者";
    if (labelMethod) labelMethod.textContent = "納入方法";
    if (labelDate) labelDate.textContent = "納入年月日";
  }

  syncCommonToHiddenFields();
}

// ================================
// 整理番号ルール
// ================================
function bindSeiriNoRule() {
  const seiri = $("seiriNo");
  if (!seiri) return;

  seiri.addEventListener("input", function () {
    this.value = this.value.replace(/[^0-9]/g, "");
    this.value = this.value.replace(/^0+/, "");
  });
}

// ================================
// 表示用
// ================================
function escapeHtml_(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function typeLabelJa_(t) {
  if (t === "shishutsu") return "支出";
  if (t === "shuunyuu") return "収入";
  return "稟議";
}

// ================================
// API
// ================================
async function api_(payload) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("GASの応答がJSONではありません: " + text);
  }
}

// ================================
// バリデーション
// ================================
function validate(payload) {
  if (!payload.type) return "未入力：区分";
  if (!payload.seiriNo) return "未入力：整理番号";

  if (!/^[1-9][0-9]*$/.test(payload.seiriNo)) {
    return "整理番号は1以上の半角数字です（先頭0不可）";
  }

  if (!payload.title) return "未入力：件名";
  if (!payload.writer) return "未入力：記載者氏名";
  if (!payload.content) return "未入力：内容";

  if (payload.type === "shishutsu") {
    if (!payload.amount) return "未入力：支払金額";
    if (!payload.payee) return "未入力：支払先";
  } else if (payload.type === "shuunyuu") {
    if (!payload.amount) return "未入力：収入金額";
    if (!payload.payer) return "未入力：納入者";
  }

  if (payload.attachments.length > 5) return "添付は5件までです";

  return "";
}

// ================================
// 添付
// ================================
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function renderSelectedFiles() {
  const box = $("fileList");
  if (!box) return;

  if (selectedFiles.length === 0) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = selectedFiles.map((file, i) => `
    <li>
      <div class="fileItemRow">
        <span>${i + 1}. ${escapeHtml_(file.name)}</span>
        <button type="button" class="fileRemoveBtn secondary" onclick="removeSelectedFile(${i})">削除</button>
      </div>
    </li>
  `).join("");
}

function removeSelectedFile(index) {
  selectedFiles.splice(index, 1);
  renderSelectedFiles();
  setStatus(`添付を削除しました（${selectedFiles.length}件）`);
}
window.removeSelectedFile = removeSelectedFile;

function addSelectedFile() {
  const input = $("fileOne");
  const file = input?.files?.[0];

  if (!file) {
    setStatus("追加するファイルを選んでください。");
    return;
  }

  if (selectedFiles.length >= 5) {
    setStatus("添付は最大5件です。");
    input.value = "";
    return;
  }

  const duplicated = selectedFiles.some(f =>
    f.name === file.name &&
    f.size === file.size &&
    f.lastModified === file.lastModified
  );

  if (duplicated) {
    setStatus("同じファイルは追加済みです。");
    input.value = "";
    return;
  }

  selectedFiles.push(file);
  input.value = "";
  renderSelectedFiles();
  setStatus(`添付を追加しました（${selectedFiles.length}件）`);
}

function clearSelectedFiles() {
  selectedFiles = [];
  if ($("fileOne")) $("fileOne").value = "";
  renderSelectedFiles();
}

// ================================
// payload
// ================================
async function buildPayload() {
  syncCommonToHiddenFields();

  const type = $("type")?.value || "";

  const payload = {
    action: "submit",
    type,
    seiriNo: v("seiriNo"),
    label: $("type")?.selectedOptions?.[0]?.text || "",
    kou: v("kou"),
    moku: v("moku"),
    setsu: v("setsu"),
    title: v("commonTitle"),
    writer: v("commonWriter"),
    content: v("commonContent"),
    attachments: []
  };

  if (type === "shishutsu") {
    payload.amount = v("moneyAmount");
    payload.payee = v("moneyPartner");
    payload.method = $("moneyMethod")?.value || "";
    payload.date = v("moneyDate");
  } else if (type === "shuunyuu") {
    payload.amount = v("moneyAmount");
    payload.payer = v("moneyPartner");
    payload.method = $("moneyMethod")?.value || "";
    payload.date = v("moneyDate");
  } else {
    payload.date = "";
  }

  for (const file of selectedFiles) {
    const dataUrl = await readFileAsDataURL(file);
    payload.attachments.push({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      dataUrl
    });
  }

  return payload;
}

// ================================
// 差し戻し表示
// ================================
function showReturnComments(d) {
  const box = $("returnBox");
  const a = $("returnCommentA");
  const b = $("returnCommentB");

  if (!box || !a || !b) return;

  const textA = d?.returnCommentA || "";
  const textB = d?.returnCommentB || "";

  if (!textA && !textB) {
    box.style.display = "none";
    a.textContent = "なし";
    b.textContent = "なし";
    return;
  }

  box.style.display = "";
  a.textContent = textA || "なし";
  b.textContent = textB || "なし";
}

// ================================
// 送信
// ================================
function setSending(flag) {
  if ($("sendBtn")) $("sendBtn").disabled = !!flag;
}

async function send() {
  setSending(true);
  setStatus("送信中…");

  try {
    const payload = await buildPayload();
    const msg = validate(payload);

    if (msg) {
      setStatus(msg);
      return;
    }

    const data = await api_(payload);

    if (!data.ok) {
      setStatus("失敗: " + (data.message || "unknown"));
      return;
    }

    setStatus(
      "送信しました / 整理番号: " + (data.seiriNo || "") +
      " / 起案番号: " + (data.kianId || "") +
      " / 添付件数: " + (data.attachmentCount ?? 0)
    );

    const no = draftNo_();
    if (no) {
      try {
        await api_({ action: "deleteDraft", draftNo: no });
      } catch (e) {}
    }

    clearForm();
    await loadStatusCounts();

  } catch (err) {
    setStatus("通信エラー: " + err);
  } finally {
    setSending(false);
  }
}

// ================================
// クリア
// ================================
function clearForm() {
  [
    "type", "seiriNo", "draftNo", "commonWriter", "kou", "moku", "setsu",
    "commonTitle", "commonContent", "moneyAmount", "moneyPartner", "moneyDate"
  ].forEach(id => {
    if ($(id)) $(id).value = "";
  });

  if ($("moneyMethod")) $("moneyMethod").value = "口座振込";

  clearSelectedFiles();
  showReturnComments(null);
  applyTypeUI();
}

function draftNo_() {
  return v("draftNo");
}

// ================================
// 復元
// ================================
function fillFormFromDraft_(d) {
  if (!d) return;

  clearForm();

  if ($("draftNo")) $("draftNo").value = d.draftNo || "";
  if ($("type")) $("type").value = d.type || "";
  if ($("seiriNo")) $("seiriNo").value = d.seiriNo || "";
  if ($("commonWriter")) $("commonWriter").value = d.writer || "";
  if ($("kou")) $("kou").value = d.kou || "";
  if ($("moku")) $("moku").value = d.moku || "";
  if ($("setsu")) $("setsu").value = d.setsu || "";
  if ($("commonTitle")) $("commonTitle").value = d.title || "";
  if ($("commonContent")) $("commonContent").value = d.content || "";

  applyTypeUI();

  if (d.type === "shishutsu") {
    if ($("moneyAmount")) $("moneyAmount").value = d.amount || "";
    if ($("moneyPartner")) $("moneyPartner").value = d.payee || "";
    if ($("moneyMethod")) $("moneyMethod").value = d.method || "口座振込";
    if ($("moneyDate")) $("moneyDate").value = d.date || "";
  } else if (d.type === "shuunyuu") {
    if ($("moneyAmount")) $("moneyAmount").value = d.amount || "";
    if ($("moneyPartner")) $("moneyPartner").value = d.payer || "";
    if ($("moneyMethod")) $("moneyMethod").value = d.method || "口座振込";
    if ($("moneyDate")) $("moneyDate").value = d.date || "";
  }

  showReturnComments(d);
  setStatus(`復元しました（番号：${d.draftNo || d.kianId || ""}）`);
}

// ================================
// 下書き保存
// ================================
async function saveDraftByNo() {
  const no = draftNo_();

  if (!no) {
    setStatus("下書き番号を入力してください。");
    return;
  }

  try {
    const payload = await buildPayload();
    payload.action = "saveDraft";
    payload.draftNo = no;
    payload.attachments = [];

    const data = await api_(payload);

    if (!data.ok) {
      setStatus("下書き保存失敗: " + (data.message || "unknown"));
      return;
    }

    setStatus(`下書きを保存しました（番号：${no}）`);
    await loadStatusCounts();

  } catch (err) {
    setStatus("下書き保存エラー: " + err);
  }
}

// ================================
// 一覧描画
// ================================
function renderStatusTable(listId, items, mode) {
  const box = $(listId);
  if (!box) return;

  if (!items || items.length === 0) {
    box.innerHTML = "（データはありません）";
    return;
  }

  box.innerHTML = `
    <div class="draftTable">
      <div class="draftHead">
        <div>番号</div>
        <div>区分</div>
        <div>整理番号</div>
        <div>件名</div>
        <div>更新</div>
        <div></div>
      </div>

      ${items.map((d, i) => `
        <div class="draftRow">
          <div>${escapeHtml_(d.draftNo || d.kianId || "")}</div>
          <div>${escapeHtml_(d.typeLabel || typeLabelJa_(d.type))}</div>
          <div>${escapeHtml_(d.seiriNo || "")}</div>
          <div class="draftTitle">${escapeHtml_(d.title || "(件名なし)")}</div>
          <div>${escapeHtml_(d.updatedAt || d.createdAt || "")}</div>
          <div class="draftBtns">
            ${
              mode === "draft" || mode === "returned"
                ? `<button class="miniBtn miniPrimary" onclick="restoreItemByStatus('${mode}', ${i})">復元</button>`
                : ""
            }
            ${
              mode === "draft"
                ? `<button class="miniBtn miniDanger" onclick="deleteDraftByStatus(${i})">削除</button>`
                : ""
            }
            ${
              mode === "approved"
                ? `? `<button class="miniBtn miniDone" onclick="markApprovedDone('${escapeHtml_(d.kianId || "")}')">確定</button>`
                : ""
            }
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// ================================
// 件数
// ================================
async function loadStatusCounts() {
  try {
    const data = await api_({ action: "getStatusCounts" });

    if (!data.ok) {
      setStatus("件数取得に失敗しました");
      return;
    }

    if ($("countDraft")) $("countDraft").textContent = data.draft ?? 0;
    if ($("countPending")) $("countPending").textContent = data.pending ?? 0;
    if ($("countReturned")) $("countReturned").textContent = data.returned ?? 0;
    if ($("countApproved")) $("countApproved").textContent = data.approved ?? 0;

  } catch (err) {
    console.error(err);
    setStatus("件数取得に失敗しました");
  }
}

// ================================
// 一覧取得
// ================================
async function loadAllStatusLists() {
  try {
    const data = await api_({ action: "listAllStatuses" });

    if (!data.ok) {
      setStatus("一覧の取得に失敗しました");
      return;
    }

    draftItemsCache = data.draftItems || [];
    pendingItemsCache = data.pendingItems || [];
    returnedItemsCache = data.returnedItems || [];
    approvedItemsCache = data.approvedItems || [];

    renderStatusTable("draftSheetList", draftItemsCache, "draft");
    renderStatusTable("pendingSheetList", pendingItemsCache, "pending");
    renderStatusTable("returnedSheetList", returnedItemsCache, "returned");
    renderStatusTable("approvedSheetList", approvedItemsCache, "approved");

  } catch (err) {
    console.error(err);
    setStatus("一覧の取得に失敗しました");
  }
}

// ================================
// 復元・削除
// ================================
function restoreItemByStatus(mode, index) {
  let item = null;
  if (mode === "draft") item = draftItemsCache[index];
  if (mode === "returned") item = returnedItemsCache[index];
  if (!item) return;
  fillFormFromDraft_(item);
}
window.restoreItemByStatus = restoreItemByStatus;

async function deleteDraftByStatus(index) {
  const item = draftItemsCache[index];
  if (!item) return;

  if (!confirm(`下書き（番号：${item.draftNo}）を削除しますか？`)) return;

  try {
    const data = await api_({
      action: "deleteDraft",
      draftNo: item.draftNo
    });

    if (!data.ok) {
      setStatus("下書き削除失敗: " + (data.message || "unknown"));
      return;
    }

    setStatus(`下書きを削除しました（番号：${item.draftNo}）`);
    await loadStatusCounts();
    $("draftListWrap").style.display = "none";
  } catch (err) {
    setStatus("下書き削除エラー: " + err);
  }
}
async function markApprovedDone(kianId) {
  if (!kianId) return;

  if (!confirm("この承認済データを確定しますか？")) return;

  try {
    setStatus("確定処理中...");

    const data = await api_({
      action: "markDone",
      kianId
    });

    if (!data.ok) {
      setStatus("確定失敗: " + (data.message || "unknown"));
      return;
    }

    setStatus("確定しました");
    await loadStatusCounts();
    await loadAllStatusLists();

  } catch (err) {
    setStatus("確定エラー: " + err);
  }
}
window.markApprovedDone = markApprovedDone;
window.deleteDraftByStatus = deleteDraftByStatus;

// ================================
// 詳細
// ================================
async function openListWithLoad(boxId) {
  const box = $(boxId);
  if (!box) return;

  const isHidden = (box.style.display === "none");

  if (!isHidden) {
    box.style.display = "none";
    return;
  }

  await loadAllStatusLists();
  box.style.display = "";
}
function hideList(boxId) {
  const box = $(boxId);
  if (!box) return;
  box.style.display = "none";
}
// ================================
// 初期化
// ================================
window.addEventListener("load", async () => {
  applyTypeUI();
  bindSeiriNoRule();
  renderSelectedFiles();
  showReturnComments(null);

  if ($("type")) $("type").addEventListener("change", applyTypeUI);
  if ($("sendBtn")) $("sendBtn").addEventListener("click", send);
  if ($("clearBtn")) $("clearBtn").addEventListener("click", clearForm);
  if ($("saveDraftBtn")) $("saveDraftBtn").addEventListener("click", saveDraftByNo);

  if ($("listDraftBtn")) {
    $("listDraftBtn").addEventListener("click", () => openListWithLoad("draftListWrap"));
  }
  if ($("btnToggleDraftList")) {
    $("btnToggleDraftList").addEventListener("click", () => openListWithLoad("draftListWrap"));
  }
  if ($("btnTogglePendingList")) {
    $("btnTogglePendingList").addEventListener("click", () => openListWithLoad("pendingListWrap"));
  }
  if ($("btnToggleReturnedList")) {
    $("btnToggleReturnedList").addEventListener("click", () => openListWithLoad("returnedListWrap"));
  }
  if ($("btnToggleApprovedList")) {
    $("btnToggleApprovedList").addEventListener("click", () => openListWithLoad("approvedListWrap"));
  }

  if ($("addFileBtn")) $("addFileBtn").addEventListener("click", addSelectedFile);
  if ($("clearFilesBtn")) $("clearFilesBtn").addEventListener("click", clearSelectedFiles);

    if ($("btnHideDraftList")) {
    $("btnHideDraftList").addEventListener("click", () => hideList("draftListWrap"));
  }
  if ($("btnHidePendingList")) {
    $("btnHidePendingList").addEventListener("click", () => hideList("pendingListWrap"));
  }
  if ($("btnHideReturnedList")) {
    $("btnHideReturnedList").addEventListener("click", () => hideList("returnedListWrap"));
  }
  if ($("btnHideApprovedList")) {
    $("btnHideApprovedList").addEventListener("click", () => hideList("approvedListWrap"));
  }
  ["commonTitle", "commonWriter", "commonContent"].forEach(id => {
    if ($(id)) $(id).addEventListener("input", syncCommonToHiddenFields);
  });

  await loadStatusCounts();
});
