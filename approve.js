// ================================
// approve.js（2人承認・A/B列保存版）
// - action=list: pending一覧
// - action=approve: side=A/B を送って A/B 列に書く
// ================================

const GAS_URL = "PASTE_GAS_WEBAPP_URL_HERE"; // ★あなたの /exec を入れる

function $(id){ return document.getElementById(id); }
function setStatus(msg){ $("status").textContent = msg || ""; }

function ymd(){
  const d = new Date();
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

function resolveKianId_(item){
  return item.kianId || item.id || "";
}

function cardHtml(item){
  const kid = resolveKianId_(item);
  const typeLabel = item.typeLabel || item.type || "";
  const title = item.title || "";
  const content = item.content || "";

  const meta = [];
  if(item.amount) meta.push(`金額：${item.amount}`);
  if(item.payee)  meta.push(`支払先：${item.payee}`);
  if(item.payer)  meta.push(`納入者：${item.payer}`);
  if(item.method) meta.push(`方法：${item.method}`);
  if(item.attachmentUrl) meta.push(`添付：${item.attachmentUrl}`);

  // 旧JSON方式の approvals が来ても表示は軽く対応（任意）
  const approvals = Array.isArray(item.approvals) ? item.approvals : [];
  const count = approvals.length;

  return `
  <div class="cardItem">
    <div class="cardHead">
      <div class="badge">${escapeHtml(typeLabel)}</div>
      <div class="kianId">起案番号：<b>${escapeHtml(kid)}</b></div>
    </div>

    <div class="title">${escapeHtml(title)}</div>
    <div class="content">${escapeHtml(content)}</div>

    ${meta.length ? `<div class="meta">${meta.map(m=>`<div>${escapeHtml(m)}</div>`).join("")}</div>` : ""}

    <details class="approvals">
      <summary>承認状況：${count}/2（クリックで詳細）</summary>
      <pre>${escapeHtml(approvals.map(a=>`・${a.name}（${a.at}）${a.comment? " / "+a.comment:""}`).join("\n") || "（承認記録はシートのA/B列で確認）")}</pre>
    </details>

    <div class="row2">
      <button type="button" class="approveBtnA" data-id="${escapeHtml(kid)}">Aで承認</button>
      <button type="button" class="approveBtnB" data-id="${escapeHtml(kid)}">Bで承認</button>
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
    const data = await post({ action:"list", status:"pending", limit:50 });
    if(!data.ok){
      setStatus("失敗： " + (data.message || "unknown"));
      return;
    }

    const list = data.items || [];
    $("list").innerHTML = list.length
      ? list.map(cardHtml).join("")
      : `<p class="help">未承認はありません。</p>`;

    document.querySelectorAll(".approveBtnA").forEach(btn=>{
      btn.addEventListener("click", ()=> approve(btn.dataset.id, "A"));
    });
    document.querySelectorAll(".approveBtnB").forEach(btn=>{
      btn.addEventListener("click", ()=> approve(btn.dataset.id, "B"));
    });

    setStatus("");
  }catch(err){
    setStatus("通信エラー： " + err);
  }
}

async function approve(kianId, side){
  if(!kianId){
    setStatus("起案番号が取得できません。listの返却を確認してください。");
    return;
  }

  const nameInput = (side==="A") ? $("approverNameA") : $("approverNameB");
  const commentInput = (side==="A") ? $("commentA") : $("commentB");

  const name = (nameInput?.value || "").trim();
  const comment = (commentInput?.value || "").trim();

  if(!name){
    setStatus(`承認者${side}の名前を入力してください。`);
    nameInput?.focus();
    return;
  }

  if(!confirm(`起案 ${kianId} を承認しますか？（${side}）`)) return;

  setStatus("承認送信中…");
  try{
    const data = await post({
      action:"approve",
      kianId,
      side,
      approverName: name,
      comment,
      at: ymd()
    });

    if(!data.ok){
      setStatus("失敗： " + (data.message || "unknown"));
      return;
    }

    await loadList();
    setStatus(`承認しました：${kianId}（${side}）`);
  }catch(err){
    setStatus("通信エラー： " + err);
  }
}

window.addEventListener("load", ()=>{
  $("today").textContent = ymd();
  $("reloadBtn").addEventListener("click", loadList);
  loadList();
});
