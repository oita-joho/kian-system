const GAS_URL = "https://script.google.com/macros/s/AKfycbwdXfLyVByUKJQOey9gbq7_Ra2lvzUu6nDwIbX1HFIUfWNsI7Gp4IbsjKiPpe93j_bd7g/exec";

const SUMMARY_CONFIG = {
  draft:    { countId: "countDraft",    wrapId: "draftListWrap",    listId: "draftSheetList" },
  pending:  { countId: "countPending",  wrapId: "pendingListWrap",  listId: "pendingSheetList" },
  returned: { countId: "countReturned", wrapId: "returnedListWrap", listId: "returnedSheetList" },
  approved: { countId: "countApproved", wrapId: "approvedListWrap", listId: "approvedSheetList" }
};

const caches = {
  draft: [],
  pending: [],
  returned: [],
  approved: []
};

let selectedFiles = [];

const $ = (id) => document.getElementById(id);
const v = (id) => ($(id)?.value || "").trim();

function setStatus(msg) {
  const el = $("status");
  if (el) el.textContent = msg || "";
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function typeLabelJa(type) {
  if (type === "shishutsu") return "支出";
  if (type === "shuunyuu") return "収入";
  return "稟議";
}

async function api(payload) {
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

/* ---------- UI ---------- */

function syncCommonToHiddenFields() {
  const type = $("type")?.value || "";
  const title = v("commonTitle");
  const writer = v("commonWriter");
  const content = v("commonContent");

  const map = {
    shishutsu: ["s_title", "s_writer", "s_content"],
    shuunyuu:  ["r_title", "r_writer", "r_content"],
    ringi:     ["g_title", "g_writer", "g_content"]
  };

  const ids = map[type];
  if (!ids) return;

  [title, writer, content].forEach((value, i) => {
    if ($(ids[i])) $(ids[i]).value = value;
  });
}

function applyTypeUI() {
  const type = $("type")?.value || "";
  const isRingi = type === "ringi";

  if ($("afterTypeFields")) $("afterTypeFields").style.display = type ? "" : "none";
  if ($("rowKms")) $("rowKms").style.display = isRingi ? "none" : "";
  if ($("rowMoney")) $("rowMoney").style.display = isRingi ? "none" : "";

  const labels = {
    shishutsu: ["支払金額", "支払先", "支払方法", "支出年月日"],
    shuunyuu:  ["収入金額", "納入者", "納入方法", "納入年月日"],
    ringi:     ["金額", "相手先", "方法", "年月日"]
  }[type] || ["金額", "相手先", "方法", "年月日"];

  ["labelAmount", "labelPartner", "labelMethod", "labelDate"].forEach((id, i) => {
    if ($(id)) $(id).textContent = labels[i];
  });

  syncCommonToHiddenFields();
}

function bindSeiriNoRule() {
  const el = $("seiriNo");
  if (!el) return;
  el.addEventListener("input", () => {
    el.value = el.value.replace(/[^0-9]/g, "").replace(/^0+/, "");
  });
}

function showReturnComments(item) {
  const box = $("returnBox");
  const a = $("returnCommentA");
  const b = $("returnCommentB");
  if (!box || !a || !b) return;

  const textA = item?.returnCommentA || "";
  const textB = item?.returnCommentB || "";

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

/* ---------- files ---------- */

function renderSelectedFiles() {
  const box = $("fileList");
  if (!box) return;

  if (!selectedFiles.length) {
    box.innerHTML = "";
    return;
  }

  box.innerHTML = selectedFiles.map((file, i) => `
    <li>
      <div class="file-item-row">
        <span>${i + 1}. ${escapeHtml(file.name)}</span>
        <button type="button" class="mini-action-btn secondary" onclick="removeSelectedFile(${i})">削除</button>
      </div>
    </li>
  `).join("");
}

window.removeSelectedFile = function(index) {
  selectedFiles.splice(index, 1);
  renderSelectedFiles();
  setStatus(`添付を削除しました（${selectedFiles.length}件）`);
};

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

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- payload ---------- */

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

function validate(payload) {
  if (!payload.type) return "未入力：区分";
  if (!payload.seiriNo) return "未入力：整理番号";
  if (!/^[1-9][0-9]*$/.test(payload.seiriNo)) return "整理番号は1以上の半角数字です";
  if (!payload.title) return "未入力：件名";
  if (!payload.writer) return "未入力：記載者氏名";
  if (!payload.content) return "未入力：内容";

  if (payload.type === "shishutsu") {
    if (!payload.amount) return "未入力：支払金額";
    if (!payload.payee) return "未入力：支払先";
  }
  if (payload.type === "shuunyuu") {
    if (!payload.amount) return "未入力：収入金額";
    if (!payload.payer) return "未入力：納入者";
  }

  if ((payload.attachments || []).length > 5) return "添付は5件までです";
  return "";
}

/* ---------- actions ---------- */

function clearForm() {
  [
    "type", "draftNo", "seiriNo", "commonWriter", "kou", "moku", "setsu",
    "commonTitle", "commonContent", "moneyAmount", "moneyPartner", "moneyDate"
  ].forEach(id => {
    if ($(id)) $(id).value = "";
  });

  if ($("moneyMethod")) $("moneyMethod").value = "口座振込";

  clearSelectedFiles();
  showReturnComments(null);
  applyTypeUI();
}

async function send() {
  setStatus("送信中...");
  try {
    const payload = await buildPayload();
    const msg = validate(payload);
    if (msg) {
      setStatus(msg);
      return;
    }

    const data = await api(payload);
    if (!data.ok) {
      setStatus("送信失敗: " + (data.message || "unknown"));
      return;
    }

    const draftNo = v("draftNo");
    if (draftNo) {
      try {
        await api({ action: "deleteDraft", draftNo });
      } catch {}
    }

    clearForm();
    await loadStatusCounts();
    setStatus("送信しました");
  } catch (err) {
    setStatus("通信エラー: " + err);
  }
}

async function saveDraftByNo() {
  const draftNo = v("draftNo");
  if (!draftNo) {
    setStatus("下書き番号を入力してください。");
    return;
  }

  try {
    const payload = await buildPayload();
    payload.action = "saveDraft";
    payload.draftNo = draftNo;
    payload.attachments = [];

    const data = await api(payload);
    if (!data.ok) {
      setStatus("下書き保存失敗: " + (data.message || "unknown"));
      return;
    }

    await loadStatusCounts();
    setStatus("下書きを保存しました");
  } catch (err) {
    setStatus("下書き保存エラー: " + err);
  }
}

/* ---------- counts ---------- */

async function loadStatusCounts() {
  try {
    const data = await api({ action: "getStatusCounts" });
    if (!data.ok) {
      setStatus("件数取得に失敗しました");
      return;
    }

    const counts = {
      countDraft: data.draft ?? 0,
      countPending: data.pending ?? 0,
      countReturned: data.returned ?? 0,
      countApproved: data.approved ?? 0
    };

    Object.entries(counts).forEach(([id, value]) => {
      if ($(id)) $(id).textContent = value;
    });
  } catch (err) {
    console.error(err);
    setStatus("件数取得に失敗しました");
  }
}

/* ---------- lists ---------- */

function actionButtons(mode, item, index) {
  const buttons = [];

  if (mode === "draft" || mode === "returned") {
    buttons.push(`<button class="mini-btn primary" onclick="restoreItem('${mode}', ${index})">復元</button>`);
  }
  if (mode === "draft") {
    buttons.push(`<button class="mini-btn danger" onclick="deleteDraftItem(${index})">削除</button>`);
  }
  if (mode === "approved") {
    buttons.push(`<button class="mini-btn done" onclick="markApprovedDone('${item.kianId}')">確定</button>`);
  }

  return buttons.join("");
}

function renderStatusTable(mode, items) {
  const cfg = SUMMARY_CONFIG[mode];
  const box = $(cfg.listId);
  if (!box) return;

  if (!items?.length) {
    box.innerHTML = "（データはありません）";
    return;
  }

  box.innerHTML = `
    <div class="data-table">
      <div class="data-head">
        <div>番号</div>
        <div>区分</div>
        <div>整理番号</div>
        <div>件名</div>
        <div>更新</div>
        <div></div>
      </div>
      ${items.map((item, index) => `
        <div class="data-row">
          <div>${escapeHtml(item.draftNo || item.kianId || "")}</div>
          <div>${escapeHtml(item.typeLabel || typeLabelJa(item.type))}</div>
          <div>${escapeHtml(item.seiriNo || "")}</div>
          <div class="data-title">${escapeHtml(item.title || "(件名なし)")}</div>
          <div>${escapeHtml(item.updatedAt || item.createdAt || "")}</div>
          <div class="row-actions">${actionButtons(mode, item, index)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

async function loadAllStatusLists() {
  try {
    const data = await api({ action: "listAllStatuses" });
    if (!data.ok) {
      setStatus("一覧の取得に失敗しました");
      return;
    }

    caches.draft = data.draftItems || [];
    caches.pending = data.pendingItems || [];
    caches.returned = data.returnedItems || [];
    caches.approved = data.approvedItems || [];

    Object.keys(SUMMARY_CONFIG).forEach(mode => {
      renderStatusTable(mode, caches[mode]);
    });
  } catch (err) {
    console.error(err);
    setStatus("一覧の取得に失敗しました");
  }
}

async function showList(mode) {
  const cfg = SUMMARY_CONFIG[mode];
  if (!cfg) return;
  await loadAllStatusLists();
  $(cfg.wrapId).style.display = "";
}

function hideList(mode) {
  const cfg = SUMMARY_CONFIG[mode];
  if (!cfg) return;
  $(cfg.wrapId).style.display = "none";
}

/* ---------- row operations ---------- */

window.restoreItem = function(mode, index) {
  const item = caches[mode]?.[index];
  if (!item) return;

  clearForm();

  if ($("draftNo")) $("draftNo").value = item.draftNo || "";
  if ($("type")) $("type").value = item.type || "";
  if ($("seiriNo")) $("seiriNo").value = item.seiriNo || "";
  if ($("commonWriter")) $("commonWriter").value = item.writer || "";
  if ($("kou")) $("kou").value = item.kou || "";
  if ($("moku")) $("moku").value = item.moku || "";
  if ($("setsu")) $("setsu").value = item.setsu || "";
  if ($("commonTitle")) $("commonTitle").value = item.title || "";
  if ($("commonContent")) $("commonContent").value = item.content || "";

  applyTypeUI();

  if (item.type === "shishutsu") {
    if ($("moneyAmount")) $("moneyAmount").value = item.amount || "";
    if ($("moneyPartner")) $("moneyPartner").value = item.payee || "";
    if ($("moneyMethod")) $("moneyMethod").value = item.method || "口座振込";
    if ($("moneyDate")) $("moneyDate").value = item.date || "";
  } else if (item.type === "shuunyuu") {
    if ($("moneyAmount")) $("moneyAmount").value = item.amount || "";
    if ($("moneyPartner")) $("moneyPartner").value = item.payer || "";
    if ($("moneyMethod")) $("moneyMethod").value = item.method || "口座振込";
    if ($("moneyDate")) $("moneyDate").value = item.date || "";
  }

  showReturnComments(item);
  setStatus("復元しました");
};

window.deleteDraftItem = async function(index) {
  const item = caches.draft[index];
  if (!item) return;
  if (!confirm(`下書き（番号：${item.draftNo}）を削除しますか？`)) return;

  try {
    const data = await api({ action: "deleteDraft", draftNo: item.draftNo });
    if (!data.ok) {
      setStatus("削除失敗: " + (data.message || "unknown"));
      return;
    }
    await loadStatusCounts();
    await loadAllStatusLists();
    setStatus("下書きを削除しました");
  } catch (err) {
    setStatus("削除エラー: " + err);
  }
};

window.markApprovedDone = async function(kianId) {
  if (!kianId) return;
  if (!confirm("この承認済を確定しますか？")) return;

  try {
    setStatus("確定処理中...");
    const data = await api({ action: "markDone", kianId });
    if (!data.ok) {
      setStatus("確定失敗: " + (data.message || "unknown"));
      return;
    }
    await loadStatusCounts();
    await loadAllStatusLists();
    setStatus("確定しました");
  } catch (err) {
    setStatus("確定エラー: " + err);
  }
};

/* ---------- init ---------- */

function bindSummaryButtons() {
  const binds = {
    btnToggleDraftListTop: () => showList("draft"),
    btnShowDraft: () => showList("draft"),
    btnHideDraft: () => hideList("draft"),
    btnShowPending: () => showList("pending"),
    btnHidePending: () => hideList("pending"),
    btnShowReturned: () => showList("returned"),
    btnHideReturned: () => hideList("returned"),
    btnShowApproved: () => showList("approved"),
    btnHideApproved: () => hideList("approved")
  };

  Object.entries(binds).forEach(([id, fn]) => {
    if ($(id)) $(id).addEventListener("click", fn);
  });
}

window.addEventListener("load", async () => {
  applyTypeUI();
  bindSeiriNoRule();
  renderSelectedFiles();
  showReturnComments(null);

  if ($("type")) $("type").addEventListener("change", applyTypeUI);

  ["commonTitle", "commonWriter", "commonContent"].forEach(id => {
    if ($(id)) $(id).addEventListener("input", syncCommonToHiddenFields);
  });

  if ($("addFileBtn")) $("addFileBtn").addEventListener("click", addSelectedFile);
  if ($("clearFilesBtn")) $("clearFilesBtn").addEventListener("click", clearSelectedFiles);
  if ($("saveDraftBtn")) $("saveDraftBtn").addEventListener("click", saveDraftByNo);
  if ($("sendBtn")) $("sendBtn").addEventListener("click", send);
  if ($("clearBtn")) $("clearBtn").addEventListener("click", clearForm);

  bindSummaryButtons();
  await loadStatusCounts();
});
