const GAS_URL = "https://script.google.com/macros/s/AKfycbwdXfLyVByUKJQOey9gbq7_Ra2lvzUu6nDwIbX1HFIUfWNsI7Gp4IbsjKiPpe93j_bd7g/exec";

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setMsg(msg) {
  if ($("msg")) $("msg").textContent = msg || "";
}

let currentType = "";

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
    throw new Error("JSONではない応答: " + text);
  }
}

function currentSort() {
  return {
    sortKey: $("sortKey")?.value || "createdAt",
    sortDir: $("sortDir")?.value || "desc"
  };
}

/* ---------------- 承認済（決定前） ---------------- */

function renderApprovedBefore(items) {
  const body = $("approvedBeforeBody");
  if (!body) return;

  if (!items || items.length === 0) {
    body.innerHTML = `<tr><td colspan="7">承認済（決定前）はありません</td></tr>`;
    return;
  }

  body.innerHTML = items.map(item => `
    <tr>
      <td>${esc(item.createdAt || "")}</td>
      <td>${esc(item.typeLabel || "")}</td>
      <td>${esc(item.seiriNo || "")}</td>
      <td>${esc(item.title || "")}</td>
      <td>${esc(item.writer || "")}</td>
      <td>${esc(item.updatedAt || "")}</td>
      <td>
        <button class="decide-btn" type="button" onclick="markDone('${esc(item.kianId)}')">決定</button>
      </td>
    </tr>
  `).join("");
}

async function loadApprovedBefore() {
  const { sortKey, sortDir } = currentSort();

  const data = await api({
    action: "listApproved",
    type: currentType,
    sortKey,
    sortDir
  });

  if (!data.ok) {
    throw new Error(data.message || "listApproved failed");
  }

  renderApprovedBefore(data.items || []);
}

/* ---------------- 決定済 ---------------- */

function renderDone(items) {
  const body = $("doneBody");
  if (!body) return;

  if (!items || items.length === 0) {
    body.innerHTML = `<tr><td colspan="7">決定済はありません</td></tr>`;
    return;
  }

  body.innerHTML = items.map(item => `
    <tr>
      <td>${esc(item.createdAt || "")}</td>
      <td>${esc(item.typeLabel || "")}</td>
      <td>${esc(item.seiriNo || "")}</td>
      <td>${esc(item.title || "")}</td>
      <td>${esc(item.writer || "")}</td>
      <td>${esc(item.doneAt || item.updatedAt || "")}</td>
      <td>
        ${item.finalPdfUrl
          ? `<a class="pdf-link" href="${esc(item.finalPdfUrl)}" target="_blank" rel="noopener noreferrer">PDFリンク</a>`
          : ""
        }
      </td>
    </tr>
  `).join("");
}

async function loadDoneList() {
  const { sortKey, sortDir } = currentSort();

  const data = await api({
    action: "list",
    status: "done",
    limit: 500
  });

  if (!data.ok) {
    throw new Error(data.message || "done list failed");
  }

  let items = data.items || [];

  if (currentType) {
    items = items.filter(x => String(x.type) === currentType);
  }

  items.sort((a, b) => {
    const av = String(a[sortKey] ?? "");
    const bv = String(b[sortKey] ?? "");
    const cmp = av.localeCompare(bv, "ja");
    return sortDir === "asc" ? cmp : -cmp;
  });

  renderDone(items);
}

/* ---------------- 決定 ---------------- */

async function markDone(kianId) {
  if (!confirm("この承認済データを決定しますか？")) return;

  setMsg("決定処理中...");

  try {
    const data = await api({
      action: "markDone",
      kianId
    });

    if (!data.ok) {
      setMsg("失敗: " + (data.message || "unknown"));
      return;
    }

    setMsg("決定しました");
    await reloadAll();

  } catch (err) {
    setMsg("エラー: " + err);
  }
}
window.markDone = markDone;

/* ---------------- 全再読込 ---------------- */

async function reloadAll() {
  setMsg("読み込み中...");

  try {
    await loadApprovedBefore();
    await loadDoneList();
    setMsg("");
  } catch (err) {
    setMsg("エラー: " + err);
  }
}

/* ---------------- 初期化 ---------------- */

window.addEventListener("load", async () => {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentType = btn.dataset.type || "";
      await reloadAll();
    });
  });

  if ($("sortKey")) $("sortKey").addEventListener("change", reloadAll);
  if ($("sortDir")) $("sortDir").addEventListener("change", reloadAll);
  if ($("reloadBtn")) $("reloadBtn").addEventListener("click", reloadAll);

  await reloadAll();
});
