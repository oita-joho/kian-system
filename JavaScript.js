// ================================
// 文書起案システム script.js
//  - 起案送信（GASへPOST）
//  - クリア
//  - 下書き番号で複数保存（localStorage）
// ================================

// ★ここをGASのWebアプリURLに差し替え（例：https://script.google.com/macros/s/....../exec）
const GAS_URL = "PASTE_GAS_WEBAPP_URL_HERE";

// ===== 画面ユーティリティ =====
function $(id) { return document.getElementById(id); }
function setStatus(msg) { $("status").textContent = msg || ""; }
function getValue(id) { return ($(id)?.value || "").trim(); }

// ===== フォームデータ =====
function getFormData_() {
  return {
    category: $("category")?.value || "",
    title: getValue("title"),
    content: getValue("content"),
    name: getValue("name"),
  };
}
function setFormData_(d) {
  if (!d) return;
  if ($("category")) $("category").value = d.category || $("category").value;
  $("title").value = d.title || "";
  $("content").value = d.content || "";
  $("name").value = d.name || "";
}

// ================================
// 下書き（番号ごとに複数）
// ================================
const DRAFTS_KEY = "kian_drafts_v1"; // { "001": {...}, "A-1": {...} }

function readDrafts_() {
  const raw = localStorage.getItem(DRAFTS_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}
function writeDrafts_(obj) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(obj));
}
function getDraftNo_() {
  return getValue("draftNo");
}

function renderDraftList() {
  const box = $("draftList");
  if (!box) return;

  const drafts = readDrafts_();
  const keys = Object.keys(drafts);

  if (keys.length === 0) {
    box.textContent = "（下書きはありません）";
    return;
  }

  // 保存日時の新しい順
  keys.sort((a, b) => {
    const ta = drafts[a]?.savedAt || "";
    const tb = drafts[b]?.savedAt || "";
    return tb.localeCompare(ta);
  });

  box.textContent = keys.map((k) => {
    const d = drafts[k] || {};
    const at = (d.savedAt || "").replace("T", " ").slice(0, 19);
    const title = (d.title || "").slice(0, 24);
    return `#${k}  ${at}  ${title}`;
  }).join("\n");
}

function saveDraftByNo() {
  const no = getDraftNo_();
  if (!no) {
    setStatus("下書き番号を入力してください。");
    return;
  }
  const drafts = readDrafts_();
  drafts[no] = { ...getFormData_(), savedAt: new Date().toISOString() };
  writeDrafts_(drafts);
  setStatus(`下書きを保存しました（番号：${no}）`);
  renderDraftList();
}

function loadDraftByNo() {
  const no = getDraftNo_();
  if (!no) {
    setStatus("下書き番号を入力してください。");
    return;
  }
  const drafts = readDrafts_();
  const d = drafts[no];
  if (!d) {
    setStatus(`その番号の下書きがありません（番号：${no}）`);
    return;
  }
  setFormData_(d);
  setStatus(`下書きを復元しました（番号：${no}）`);
}

function deleteDraftByNo() {
  const no = getDraftNo_();
  if (!no) {
    setStatus("下書き番号を入力してください。");
    return;
  }
  const drafts = readDrafts_();
  if (!drafts[no]) {
    setStatus(`その番号の下書きがありません（番号：${no}）`);
    return;
  }
  if (!confirm(`下書き（番号：${no}）を削除しますか？`)) return;

  delete drafts[no];
  writeDrafts_(drafts);
  setStatus(`下書きを削除しました（番号：${no}）`);
  renderDraftList();
}

// 任意：入力のたびに「今入力中の番号」に自動保存（番号が空なら保存しない）
let draftTimer = null;
function autoSaveDraftByNo() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const no = getDraftNo_();
    if (!no) return;

    const data = getFormData_();
    if (!data.title && !data.content && !data.name) return;

    const drafts = readDrafts_();
    drafts[no] = { ...data, savedAt: new Date().toISOString() };
    writeDrafts_(drafts);
    renderDraftList();
  }, 500);
}

// ================================
// 起案送信
// ================================
function setSending_(sending) {
  $("sendBtn").disabled = !!sending;
  $("clearBtn").disabled = !!sending;
}

async function send() {
  const payload = getFormData_();

  if (!payload.title || !payload.content || !payload.name) {
    setStatus("未入力があります（件名・内容・提出者）");
    return;
  }
  if (!GAS_URL || GAS_URL.includes("PASTE_GAS_WEBAPP_URL_HERE")) {
    setStatus("GAS_URL が未設定です（script.js の先頭を確認してください）。");
    return;
  }

  setSending_(true);
  setStatus("送信中…");

  try {
    // action を付ける（GAS側が submit/list/update 方式の場合に対応）
    const body = JSON.stringify({ action: "submit", ...payload });

    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("GASの返却がJSONではありません: " + text);
    }

    if (!data.ok) {
      setStatus("失敗： " + (data.message || "unknown"));
      return;
    }

    // 送信成功
    setStatus(
      "送信しました。\n" +
      "起案番号： " + data.kianId + "\n" +
      "保存先： " + data.fileUrl
    );

    // 成功したらフォームをクリア（必要ならコメントアウトOK）
    // clearForm();

    // 送信成功したら「その下書き番号」の下書きを削除（任意だが便利）
    const no = getDraftNo_();
    if (no) {
      const drafts = readDrafts_();
      if (drafts[no]) {
        delete drafts[no];
        writeDrafts_(drafts);
        renderDraftList();
      }
    }

  } catch (err) {
    setStatus("通信エラー： " + err);
  } finally {
    setSending_(false);
  }
}

// ================================
// クリア
// ================================
function clearForm() {
  $("title").value = "";
  $("content").value = "";
  $("name").value = "";
  setStatus("");
}

// ================================
// 起動時イベント登録
// ================================
window.addEventListener("load", () => {
  // ボタン
  $("sendBtn")?.addEventListener("click", send);
  $("clearBtn")?.addEventListener("click", clearForm);

  $("saveDraftBtn")?.addEventListener("click", saveDraftByNo);
  $("loadDraftBtn")?.addEventListener("click", loadDraftByNo);
  $("deleteDraftBtn")?.addEventListener("click", deleteDraftByNo);
  $("listDraftBtn")?.addEventListener("click", renderDraftList);

  // 入力イベントで自動保存（番号ありのときだけ）
  ["draftNo", "category", "title", "content", "name"].forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener("input", autoSaveDraftByNo);
    el.addEventListener("change", autoSaveDraftByNo);
  });

  renderDraftList();
});
// 区分で表示ブロックを切替
function switchKbnBlock() {
  const kbn = document.getElementById("kbn").value;
  document.querySelectorAll(".kbn-block").forEach(block => {
    const active = block.dataset.kbn === kbn;
    block.classList.toggle("is-active", active);

    // ★重要：非表示ブロックの入力は送らない・保存対象から外したい場合は disabled にする
    block.querySelectorAll("input, textarea, select").forEach(el => {
      el.disabled = !active;
    });
  });
}

document.getElementById("kbn").addEventListener("change", switchKbnBlock);
switchKbnBlock(); // 初期表示
