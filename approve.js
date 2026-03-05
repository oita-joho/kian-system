// ================================
// approve.js（2人承認・順番なし）
// ================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbxF0N73CTWMaE4WVWCa8wkojtmtARi20cVh5SPo0ENyG7ZTBM8saN0Kn9Kf2cdC6SNU/exec"; // ★あなたの /exec を入れる

function $(id){ return document.getElementById(id); }
function setStatus(msg){ $("status").textContent = msg || ""; }

function ymd(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const MY_SIDE_KEY = "kian_my_side_v1";

function mySide_(){
  const r = document.querySelector('input[name="mySide"]:checked');
  return r ? r.value : "A";
}

function getApproverInput_(){
  const side = mySide_();
  const name = (side==="A" ? $("approverNameA").value : $("approverNameB").value).trim();
  const comment = (side==="A" ? $("commentA").value : $("commentB").value).trim();
  return { side, name, comment };
}

function rememberSide_(){
  localStorage.setItem(MY_SIDE_KEY, mySide_());
}

function restoreSide_(){
  const s = localStorage.getItem(MY_SIDE_KEY);
  if(!s) return;
  const el = document.querySelector(`input[name="mySide"][value="${s}"]`);
  if(el) el.checked = true;
}
async function post(payload){
  const res = await fetch(GAS_URL, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  const text = await res.text();
  let data;
  try{ data = JSON.parse(text); }
  catch{ throw new Error("GASの返却がJSONではありません: " + text); }
  return data;
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#39;");
}

function cardHtml(item){
  const approvals = item.approvals || [];
  const count = approvals.length;

  const approvalsText = approvals.map(a=>{
    return `・${a.name}（${a.at}） ${a.comment ? " / " + a.comment : ""}`;
  }).join("\n") || "（まだ承認なし）";

  return `
  <div class="cardItem">
    <div class="cardHead">
      <div class="badge">${escapeHtml(item.typeLabel || item.type || "")}</div>
      <div class="kianId">起案番号：<b>${escapeHtml(item.kianId)}</b></div>
    </div>

    <div class="title">${escapeHtml(item.title || "")}</div>
    <div class="content">${escapeHtml(item.content || "")}</div>

    <div class="meta">
      ${item.amount ? `<div>金額：${escapeHtml(item.amount)}</div>` : ""}
      ${item.payee ? `<div>支払先：${escapeHtml(item.payee)}</div>` : ""}
      ${item.payer ? `<div>納入者：${escapeHtml(item.payer)}</div>` : ""}
      ${item.method ? `<div>方法：${escapeHtml(item.method)}</div>` : ""}
    </div>

    <details class="approvals">
      <summary>承認状況：${count}/2（クリックで詳細）</summary>
      <pre>${escapeHtml(approvalsText)}</pre>
    </details>

    <div class="row">
      <button type="button" class="approveBtn" data-id="${escapeHtml(item.kianId)}">
        承認する（この起案）
      </button>
    </div>
  </div>`;
}

async function loadList(){
  if(!GAS_URL || GAS_URL.includes("PASTE_GAS_WEBAPP_URL_HERE")){
    setStatus("GAS_URL が未設定です（approve.js先頭）。");
    return;
  }

  setStatus("一覧取得中…");
  try{
    const data = await post({ action:"list", status:"pending", limit: 50 });
    if(!data.ok){
      setStatus("失敗： " + (data.message || "unknown"));
      return;
    }

    const list = data.items || [];
    $("list").innerHTML = list.length
      ? list.map(cardHtml).join("")
      : `<p class="help">未承認はありません。</p>`;

    // ボタンにイベント付与
    document.querySelectorAll(".approveBtn").forEach(btn=>{
      btn.addEventListener("click", ()=> approve(btn.dataset.id));
    });

    setStatus("");
  }catch(err){
    setStatus("通信エラー： " + err);
  }
}

async function approve(kianId){
  const name = $("approverName").value.trim();
  const comment = $("comment").value.trim();

  if(!name){
    setStatus("承認者名を入力してください。");
    $("approverName").focus();
    return;
  }

  if(!confirm(`起案 ${kianId} を承認しますか？`)) return;

  setStatus("承認送信中…");
  try{
    const data = await post({
      action:"approve",
      kianId,
      approverName: name,
      comment,
      at: ymd()
    });

    if(!data.ok){
      setStatus("失敗： " + (data.message || "unknown"));
      return;
    }

    // 更新して反映
    await loadList();
    setStatus(`承認しました：${kianId}`);
  }catch(err){
    setStatus("通信エラー： " + err);
  }
}

window.addEventListener("load", ()=>{
  $("today").textContent = ymd();
  $("reloadBtn").addEventListener("click", loadList);
  loadList();
});
