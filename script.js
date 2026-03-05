// ================================
// script.js（HTMLに合わせた最小・動作確認用）
//  - 区分でフォーム切替
//  - GASへ送信（submit）
// ================================

// ★ここをGASのWebアプリURLに差し替え
const GAS_URL = "PASTE_GAS_WEBAPP_URL_HERE";

function $(id) { return document.getElementById(id); }
function setStatus(msg) { $("status").textContent = msg || ""; }
function v(id) { return ($(`${id}`)?.value || "").trim(); }

function applyTypeUI() {
  const t = $("type").value;
  $("form_shishutsu").style.display = (t === "shishutsu") ? "" : "none";
  $("form_shuunyuu").style.display  = (t === "shuunyuu")  ? "" : "none";
  $("form_ringi").style.display     = (t === "ringi")     ? "" : "none";
}

function validate(payload) {
  if (payload.type === "shishutsu") {
    if (!payload.kou || !payload.moku || !payload.setsu) return "未入力：項・目・節";
    if (!payload.title) return "未入力：件名";
    if (!payload.content) return "未入力：内容";
    if (!payload.amount) return "未入力：支出金額";
    if (!payload.payee) return "未入力：支払先";
    return "";
  }
  if (payload.type === "shuunyuu") {
    if (!payload.kou || !payload.moku || !payload.setsu) return "未入力：項・目・節";
    if (!payload.title) return "未入力：件名";
    if (!payload.content) return "未入力：内容";
    if (!payload.amount) return "未入力：収入金額";
    if (!payload.payer) return "未入力：納入者";
    return "";
  }
  // ringi
  if (!payload.title) return "未入力：件名";
  if (!payload.content) return "未入力：内容";
  return "";
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = (e) => reject(e);
    r.readAsDataURL(file);
  });
}

async function buildPayload() {
  const type = $("type").value;

  if (type === "shishutsu") {
    return {
      action: "submit",
      type,
      label: "支出負担行為",
      kou: v("s_kou"),
      moku: v("s_moku"),
      setsu: v("s_setsu"),
      title: v("s_title"),
      content: v("s_content"),
      amount: v("s_amount"),
      payee: v("s_payee"),
      method: $("s_method").value || ""
    };
  }

  if (type === "shuunyuu") {
    return {
      action: "submit",
      type,
      label: "収入行為",
      kou: v("r_kou"),
      moku: v("r_moku"),
      setsu: v("r_setsu"),
      title: v("r_title"),
      content: v("r_content"),
      amount: v("r_amount"),
      payer: v("r_payer"),
      method: $("r_method").value || ""
    };
  }

  // ringi
  const payload = {
    action: "submit",
    type,
    label: "稟議行為",
    title: v("g_title"),
    content: v("g_content"),
    attachment: null
  };

  const file = $("g_file")?.files?.[0] || null;
  if (file) {
    const dataUrl = await readFileAsDataURL(file);
    payload.attachment = {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      dataUrl
    };
  }
  return payload;
}

function setSending(sending) {
  $("sendBtn").disabled = !!sending;
}

async function send() {
  if (!GAS_URL || GAS_URL.includes("PASTE_GAS_WEBAPP_URL_HERE")) {
    setStatus("GAS_URL が未設定です（script.js先頭）。");
    return;
  }

  setSending(true);
  setStatus("送信準備中…");

  try {
    const payload = await buildPayload();
    const msg = validate(payload);
    if (msg) { setStatus(msg); return; }

    setStatus("送信中…");

    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error("GASの返却がJSONではありません: " + text); }

    if (!data.ok) {
      setStatus("失敗： " + (data.message || "unknown"));
      return;
    }

    setStatus(
      "送信しました。\n" +
      "起案番号： " + data.kianId + "\n" +
      "保存先： " + data.fileUrl
    );

  } catch (err) {
    setStatus("通信エラー： " + err);
  } finally {
    setSending(false);
  }
}

window.addEventListener("load", () => {
  applyTypeUI();
  $("type").addEventListener("change", applyTypeUI);
  $("sendBtn").addEventListener("click", send);
});
