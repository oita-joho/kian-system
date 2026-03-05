
// ================================
// approve.js（2人承認・左右A/B・順番なし）
// - 左右に承認者A / 承認者B の入力欄
// - 「自分はこちら」を選ぶと、その側の入力だけで承認できる
// - 自分側（A/B）は localStorage に記憶
// - action=list（pending取得） / action=approve（承認登録）
// ================================

const GAS_URL = "https://script.google.com/macros/s/AKfycbxF0N73CTWMaE4WVWCa8wkojtmtARi20cVh5SPo0ENyG7ZTBM8saN0Kn9Kf2cdC6SNU/exec"; // ★あなたの /exec を入れる
const MY_SIDE_KEY = "kian_my_side_v1";

function $(id) { return document.getElementById(id); }
function setStatus(msg) { $("status").textContent = msg || ""; }

function ymd() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function post(payload) {
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error("GASの返却がJSONではありません: " + text); }
  return data;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function mySide_() {
  const r = document.querySelector('input[name="mySide"]:checked');
  return r ? r.value : "A";
}

function rememberSide_() {
  localStorage.setItem(MY_SIDE_KEY, mySide_());
}

function restoreSide_() {
  const s = localStorage.getItem(MY_SIDE_KEY);
  if (!s) return;
  const el = document.querySelector(`input[name="mySide"][value="${s}"]`);
  if (el) el.checked = true;
}

function getApproverInput_() {
  const side = mySide_();
  const name = (side === "A" ? $("approverNameA").value : $("approverNameB").value).trim();
  const comment = (side === "A" ? $("commentA").value : $("commentB").value).trim();
  return { side, name, comment };
}

function resolveKianId_(item) {
  // どれかに入っていればOK（以前 kianId required が出た対策）
  return item.kianId || item.id || item.rowId || "";
}

function approvalsText_(approvals) {
  if (!Array.isArray(approvals) || approvals.length === 0) return "（まだ承認なし）";
  return approvals.map(a => `・${a.name}（${a.at}）${a.comment ? " / " + a.comment : ""}`).join("\n");
}

function cardHtml(item) {
  const kid = resolveKianId_(item);
  const approvals = item.approvals || [];
  const count = approvals.length;

  const typeLabel = item.typeLabel || item.type || "";
  const title = item.title || "";
  const content = item.content || "";

  const meta = [
    item.amount ? `金額：${item.amount}` : "",
    item.payee ? `支払先：${item.payee}` : "",
    item.payer ? `納入者：${item.payer}` : "",
    item.method ? `方法：${item.method}` : "",
    item.attachmentUrl ? `添付：${item.attachmentUrl}` : "",
  ].filter(Boolean);

  return `
  <div class="cardItem">
    <div class="cardHead">
      <div class="badge">${escapeHtml(typeLabel)}</div>
      <div class="kianId">起案番号：<b>${escapeHtml(kid)}</b></div>
    </div>

    <div class="title">${escapeHtml(title)}</div>
    <div class="content">${escapeHtml(content)}</div>

    ${meta.length ? `<div class="meta">${meta.map(m => `<div>${escapeHtml(m)}</div>`).join("")}</div>` : ""}

    <details class="approvals">
      <summary>承認状況：${count}/2（クリックで詳細）</summary>
      <pre>${escapeHtml(approvalsText_(approvals))}</pre>
    </details>

    <div class="row">
      <button type="button" class="approveBtn" data-id="${escapeHtml(kid)}">
        承認する（自分の側：${mySide_()}）
      </button>
    </div>
  </div>`;
}

async function loadList() {
  if (!GAS_URL || GAS_URL.includes("PASTE_GAS_WEBAPP_URL_HERE")) {
    setStatus("GAS_URL が未設定です（approve.js先頭）。");
    return;
  }

  setStatus("一覧取得中…");
  try {
    const data = await post({ action: "list", status: "pending", limit: 50 });
    if (!data.ok) {
      setStatus("失敗： " + (data.message || "unknown"));
      return;
    }

    const list = data.items || [];
    $("list").innerHTML = list.length
      ? list.map(cardHtml).join("")
      : `<p class="help">未承認はありません。</p>`;

    // ボタンにイベント付与
    document.querySelectorAll(".approveBtn").forEach(btn => {
      btn.addEventListener("click", () => approve(btn.dataset.id));
    });

    setStatus("");
  } catch (err) {
    setStatus("通信エラー： " + err);
  }
}

async function approve(kianId) {
  if (!kianId) {
    setStatus("このカードの起案番号(kianId)が取得できていません。GASの list 出力を確認してください。");
    return;
  }

  const { side, name, comment } = getApproverInput_();

  if (!name) {
    setStatus(`承認者${side}の名前を入力してください。`);
    (side === "A" ? $("approverNameA") : $("approverNameB")).focus();
    return;
  }

  if (!confirm(`起案 ${kianId} を承認しますか？（あなた：承認者${side}）`)) return;

  setStatus("承認送信中…");
  try {
    const data = await post({
      action: "approve",
      kianId,
      approverName: name,
      comment,
      at: ymd(),
      side // 送るだけ（GAS側で使わなくてもOK）
    });

    if (!data.ok) {
      setStatus("失敗： " + (data.message || "unknown"));
      return;
    }

    await loadList();
    setStatus(`承認しました：${kianId}（承認者${side}）`);
  } catch (err) {
    setStatus("通信エラー： " + err);
  }
}

window.addEventListener("load", () => {
  $("today").textContent = ymd();

  restoreSide_();
  document.querySelectorAll('input[name="mySide"]').forEach(r => {
    r.addEventListener("change", () => {
      rememberSide_();
      loadList(); // ボタン文言の表示を更新
    });
  });

  $("reloadBtn").addEventListener("click", loadList);
  loadList();
});

