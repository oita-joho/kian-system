//
const GAS_URL = "https://script.google.com/macros/s/AKfycbzT5KyySZTvWShiuqsOMY-BV3q4Udnw9HpGPYycJ_t9iq2SHmggFj22AsC1LbKLHEa9TA/exec";

function $(id) {
  return document.getElementById(id);
}

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
    throw new Error("JSONではない応答: " + text);
  }
}

function renderRows(items) {
  const body = $("approvedBody");
  if (!body) return;

  if (!items || items.length === 0) {
    body.innerHTML = `<tr><td colspan="8">データはありません</td></tr>`;
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
        ${item.finalPdfUrl ? `<a class="pdf-link" href="${esc(item.finalPdfUrl)}" target="_blank" rel="noopener noreferrer">PDF</a>` : ""}
      </td>
      <td>
        <button class="done-btn" type="button" onclick="markDone('${esc(item.kianId)}')">決定</button>
      </td>
    </tr>
  `).join("");
}

async function loadApprovedList() {
  setMsg("読み込み中...");

  try {
    const data = await api_({
      action: "listApproved",
      type: currentType,
      sortKey: $("sortKey")?.value || "createdAt",
      sortDir: $("sortDir")?.value || "desc"
    });

    if (!data.ok) {
      setMsg("読み込み失敗: " + (data.message || "unknown"));
      return;
    }

    renderRows(data.items || []);
    setMsg("");

  } catch (err) {
    setMsg("エラー: " + err);
  }
}

async function markDone(kianId) {
  if (!confirm("この承認済データを決定にしますか？")) return;

  setMsg("決定処理中...");

  try {
    const data = await api_({
      action: "markDone",
      kianId
    });

    if (!data.ok) {
      setMsg("失敗: " + (data.message || "unknown"));
      return;
    }

    setMsg("決定しました");
    await loadApprovedList();

  } catch (err) {
    setMsg("エラー: " + err);
  }
}
window.markDone = markDone;

window.addEventListener("load", async () => {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentType = btn.dataset.type || "";
      await loadApprovedList();
    });
  });

  if ($("sortKey")) $("sortKey").addEventListener("change", loadApprovedList);
  if ($("sortDir")) $("sortDir").addEventListener("change", loadApprovedList);
  if ($("reloadBtn")) $("reloadBtn").addEventListener("click", loadApprovedList);

  await loadApprovedList();
});
