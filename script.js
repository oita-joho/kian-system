// ================================
// script.js
// 下書き一覧表形式・復元・削除対応版
// 共通入力欄対応版
// s_date / r_date → GASには date で送信
// ================================

const GAS_URL = "https://script.google.com/macros/s/AKfycbwdXfLyVByUKJQOey9gbq7_Ra2lvzUu6nDwIbX1HFIUfWNsI7Gp4IbsjKiPpe93j_bd7g/exec";

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

  if ($("form_shishutsu")) {
    $("form_shishutsu").style.display = (t === "shishutsu") ? "" : "none";
  }
  if ($("form_shuunyuu")) {
    $("form_shuunyuu").style.display = (t === "shuunyuu") ? "" : "none";
  }
  if ($("form_ringi")) {
    $("form_ringi").style.display = (t === "ringi") ? "" : "none";
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
    if (!payload.amount) return "未入力：支出金額";
    if (!payload.payee) return "未入力：支払先";
  } else if (payload.type === "shuunyuu") {
    if (!payload.amount) return "未入力：収入金額";
    if (!payload.payer) return "未入力：納入者";
  }

  if (payload.attachments.length > 5) return "添付は5件までです";

  return "";
}

// ================================
// 添付ファイル
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
  setStatus("添付を全削除しました。");
}

// ================================
// payload作成
// ================================
async function buildPayload() {
  syncCommonToHiddenFields();

  const type = $("type")?.value || "";
  const seiriNo = v("seiriNo");

  const payload = {
    action: "submit",
    type,
    seiriNo,
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
    payload.amount = v("s_amount");
    payload.payee = v("s_payee");
    payload.method = $("s_method")?.value || "";
    payload.date = v("s_date");
  } else if (type === "shuunyuu") {
    payload.amount = v("r_amount");
    payload.payer = v("r_payer");
    payload.method = $("r_method")?.value || "";
    payload.date = v("r_date");
  } else if (type === "ringi") {
    payload.date = "";
  }

  if (selectedFiles.length > 5) {
    throw new Error("添付は5件までです");
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
        await api_({
          action: "deleteDraft",
          draftNo: no
        });
      } catch (e) {
        console.warn(e);
      }
    }

    clearForm();
    await loadDraftsFromSheet();

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
  if ($("type")) $("type").value = "";
  if ($("seiriNo")) $("seiriNo").value = "";
  if ($("draftNo")) $("draftNo").value = "";
  if ($("kou")) $("kou").value = "";
  if ($("moku")) $("moku").value = "";
  if ($("setsu")) $("setsu").value = "";
  if ($("commonTitle")) $("commonTitle").value = "";
  if ($("commonWriter")) $("commonWriter").value = "";
  if ($("commonContent")) $("commonContent").value = "";

  [
    "s_title", "s_writer", "s_content", "s_amount", "s_payee", "s_date",
    "r_title", "r_writer", "r_content", "r_amount", "r_payer", "r_date",
    "g_title", "g_writer", "g_content"
  ].forEach(id => {
    if ($(id)) $(id).value = "";
  });

  if ($("s_method")) $("s_method").value = "口座振込";
  if ($("r_method")) $("r_method").value = "口座振込";

  clearSelectedFiles();
  applyTypeUI();
}

// ================================
// 下書き
// ================================
function draftNo_() {
  return v("draftNo");
}

function fillFormFromDraft_(d) {
  if (!d) return;

  clearForm();

  if ($("draftNo")) $("draftNo").value = d.draftNo || "";
  if ($("seiriNo")) $("seiriNo").value = d.seiriNo || "";
  if ($("type")) $("type").value = d.type || "";
  if ($("kou")) $("kou").value = d.kou || "";
  if ($("moku")) $("moku").value = d.moku || "";
  if ($("setsu")) $("setsu").value = d.setsu || "";
  if ($("commonTitle")) $("commonTitle").value = d.title || "";
  if ($("commonWriter")) $("commonWriter").value = d.writer || "";
  if ($("commonContent")) $("commonContent").value = d.content || "";

  applyTypeUI();

  if (d.type === "shishutsu") {
    if ($("s_amount")) $("s_amount").value = d.amount || "";
    if ($("s_payee")) $("s_payee").value = d.payee || "";
    if ($("s_method")) $("s_method").value = d.method || "口座振込";
    if ($("s_date")) $("s_date").value = d.date || "";
  }

  if (d.type === "shuunyuu") {
    if ($("r_amount")) $("r_amount").value = d.amount || "";
    if ($("r_payer")) $("r_payer").value = d.payer || "";
    if ($("r_method")) $("r_method").value = d.method || "口座振込";
    if ($("r_date")) $("r_date").value = d.date || "";
  }

  setStatus(`下書きを復元しました（番号：${d.draftNo || ""}）`);
}

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
    await loadDraftsFromSheet();

  } catch (err) {
    setStatus("下書き保存エラー: " + err);
  }
}

// ================================
// 下書き一覧
// ================================
function renderDraftsFromSheet(items) {
  const box = $("draftSheetList");
  if (!box) return;

  draftItemsCache = Array.isArray(items) ? items : [];

  if (draftItemsCache.length === 0) {
    box.innerHTML = "（下書きはありません）";
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

      ${draftItemsCache.map((d, i) => `
        <div class="draftRow">
          <div>${escapeHtml_(d.draftNo || "")}</div>
          <div>${escapeHtml_(d.typeLabel || typeLabelJa_(d.type))}</div>
          <div>${escapeHtml_(d.seiriNo || "")}</div>
          <div class="draftTitle">${escapeHtml_(d.title || "(件名なし)")}</div>
          <div>${escapeHtml_(d.updatedAt || d.createdAt || "")}</div>
          <div class="draftBtns">
            <button class="miniBtn miniPrimary" onclick="restoreDraftFromList(${i})">復元</button>
            <button class="miniBtn miniDanger" onclick="deleteDraftFromList(${i})">削除</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

async function loadDraftsFromSheet() {
  const box = $("draftSheetList");
  if (box) box.textContent = "読み込み中...";

  try {
    const data = await api_({
      action: "listDrafts"
    });

    if (!data.ok) {
      if (box) box.textContent = "読み込み失敗";
      return;
    }

    renderDraftsFromSheet(data.items || []);

  } catch (err) {
    if (box) box.textContent = "読み込み失敗";
    console.error(err);
  }
}

function restoreDraftFromList(index) {
  const item = draftItemsCache[index];
  if (!item) return;
  fillFormFromDraft_(item);
}
window.restoreDraftFromList = restoreDraftFromList;

async function deleteDraftFromList(index) {
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
    await loadDraftsFromSheet();

  } catch (err) {
    setStatus("下書き削除エラー: " + err);
  }
}
window.deleteDraftFromList = deleteDraftFromList;

// ================================
// 初期化
// ================================
window.addEventListener("load", async () => {
  applyTypeUI();
  bindSeiriNoRule();
  renderSelectedFiles();

  if ($("type")) $("type").addEventListener("change", applyTypeUI);
  if ($("sendBtn")) $("sendBtn").addEventListener("click", send);
  if ($("clearBtn")) $("clearBtn").addEventListener("click", clearForm);

  if ($("saveDraftBtn")) $("saveDraftBtn").addEventListener("click", saveDraftByNo);
  if ($("listDraftBtn")) $("listDraftBtn").addEventListener("click", loadDraftsFromSheet);

  if ($("addFileBtn")) $("addFileBtn").addEventListener("click", addSelectedFile);
  if ($("clearFilesBtn")) $("clearFilesBtn").addEventListener("click", clearSelectedFiles);

  ["commonTitle", "commonWriter", "commonContent"].forEach(id => {
    if ($(id)) $(id).addEventListener("input", syncCommonToHiddenFields);
  });

  await loadDraftsFromSheet();
});
