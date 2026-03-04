// ================================
// 文書起案システム script.js
//  - 起案送信（GASへPOST）
//  - クリア
//  - 下書き番号で複数保存（localStorage）
// ================================

// ★ここをGASのWebアプリURLに差し替え
const GAS_URL = "PASTE_GAS_WEBAPP_URL_HERE";

function $(id){ return document.getElementById(id); }
function setStatus(msg){ $("status").textContent = msg || ""; }
function v(id){ return ($(id)?.value || "").trim(); }

// ================================
// 区分でフォーム切替
// ================================
function applyTypeUI(){
  const t = $("type").value;
  $("form_shishutsu").style.display = (t==="shishutsu") ? "" : "none";
  $("form_shuunyuu").style.display  = (t==="shuunyuu") ? "" : "none";
  $("form_ringi").style.display     = (t==="ringi") ? "" : "none";
}

// ================================
// 入力取得（区分に応じて）
// ================================
async function getPayloadByType(){
  const type = $("type").value;

  if(type === "shishutsu"){
    return {
      type,
      label: "支出負担行為",
      kou: v("s_kou"),
      moku: v("s_moku"),
      setsu: v("s_setsu"),
      amount: v("s_amount"),            // 支出金額
      title: v("s_title"),
      content: v("s_content"),
      payee: v("s_payee"),              // 支払先
      method: $("s_method").value || "" // 支払方法
    };
  }

  if(type === "shuunyuu"){
    return {
      type,
      label: "収入行為",
      kou: v("r_kou"),
      moku: v("r_moku"),
      setsu: v("r_setsu"),
      amount: v("r_amount"),             // 収入金額
      title: v("r_title"),
      content: v("r_content"),
      payer: v("r_payer"),               // 納入者
      method: $("r_method").value || ""  // 納入方法
    };
  }

  // ringi（添付あり）
  const fileInput = $("g_file");
  const file = fileInput?.files?.[0] || null;

  const payload = {
    type,
    label: "稟議行為",
    title: v("g_title"),
    content: v("g_content"),
    attachment: null // 後で入れる
  };

  if(file){
    const dataUrl = await readFileAsDataURL(file);
    payload.attachment = {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      dataUrl
    };
  }
  return payload;
}

function readFileAsDataURL(file){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onload = ()=> resolve(reader.result);
    reader.onerror = (e)=> reject(e);
    reader.readAsDataURL(file);
  });
}

// ================================
// 必須チェック（区分ごと）
// ================================
function validatePayload(p){
  if(p.type === "shishutsu"){
    if(!p.amount || !p.title || !p.payee) return "未入力があります（支出金額・件名・支払先）";
    return "";
  }
  if(p.type === "shuunyuu"){
    if(!p.amount || !p.title || !p.payer) return "未入力があります（収入金額・件名・納入者）";
    return "";
  }
  // ringi
  if(!p.title || !p.content) return "未入力があります（件名・内容）";
  return "";
}

// ================================
// 下書き（番号ごと複数）
//  - 区分(type)も一緒に保存
//  - 添付は下書きには保存しない（容量対策）
// ================================
const DRAFTS_KEY = "kian_drafts_multi_v1";

function readDrafts_(){
  const raw = localStorage.getItem(DRAFTS_KEY);
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch{ return {}; }
}
function writeDrafts_(obj){
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(obj));
}
function draftNo_(){ return v("draftNo"); }

function getDraftDataNow_(){
  const type = $("type").value;
  const base = { type };

  if(type==="shishutsu"){
    return {
      ...base,
      s_kou:v("s_kou"), s_moku:v("s_moku"), s_setsu:v("s_setsu"),
      s_amount:v("s_amount"), s_title:v("s_title"), s_content:v("s_content"),
      s_payee:v("s_payee"), s_method:$("s_method").value || ""
    };
  }
  if(type==="shuunyuu"){
    return {
      ...base,
      r_kou:v("r_kou"), r_moku:v("r_moku"), r_setsu:v("r_setsu"),
      r_amount:v("r_amount"), r_title:v("r_title"), r_content:v("r_content"),
      r_payer:v("r_payer"), r_method:$("r_method").value || ""
    };
  }
  return {
    ...base,
    g_title:v("g_title"), g_content:v("g_content")
    // 添付は保存しない
  };
}

function applyDraftData_(d){
  if(!d) return;
  if(d.type){
    $("type").value = d.type;
    applyTypeUI();
  }

  if(d.type==="shishutsu"){
    $("s_kou").value = d.s_kou || "";
    $("s_moku").value = d.s_moku || "";
    $("s_setsu").value = d.s_setsu || "";
    $("s_amount").value = d.s_amount || "";
    $("s_title").value = d.s_title || "";
    $("s_content").value = d.s_content || "";
    $("s_payee").value = d.s_payee || "";
    $("s_method").value = d.s_method || $("s_method").value;
  }else if(d.type==="shuunyuu"){
    $("r_kou").value = d.r_kou || "";
    $("r_moku").value = d.r_moku || "";
    $("r_setsu").value = d.r_setsu || "";
    $("r_amount").value = d.r_amount || "";
    $("r_title").value = d.r_title || "";
    $("r_content").value = d.r_content || "";
    $("r_payer").value = d.r_payer || "";
    $("r_method").value = d.r_method || $("r_method").value;
  }else{
    $("g_title").value = d.g_title || "";
    $("g_content").value = d.g_content || "";
    if($("g_file")) $("g_file").value = ""; // 添付は復元不可
  }
}

function renderDraftList(){
  const box = $("draftList");
  if(!box) return;

  const drafts = readDrafts_();
  const keys = Object.keys(drafts);
  if(keys.length===0){ box.textContent="（下書きはありません）"; return; }

  keys.sort((a,b)=> (drafts[b]?.savedAt||"").localeCompare(drafts[a]?.savedAt||""));

  const typeLabel = (t)=> t==="shishutsu" ? "支出" : t==="shuunyuu" ? "収入" : "稟議";

  box.textContent = keys.map(k=>{
    const d = drafts[k] || {};
    const at = (d.savedAt||"").replace("T"," ").slice(0,19);
    const t = typeLabel(d.type);
    // タイトルっぽいものを抜く
    const title =
      d.type==="shishutsu" ? (d.s_title||"") :
      d.type==="shuunyuu" ? (d.r_title||"") :
      (d.g_title||"");
    return `#${k}  ${at}  [${t}]  ${String(title).slice(0,24)}`;
  }).join("\n");
}

function saveDraftByNo(){
  const no = draftNo_();
  if(!no){ setStatus("下書き番号を入力してください。"); return; }

  const drafts = readDrafts_();
  drafts[no] = { ...getDraftDataNow_(), savedAt:new Date().toISOString() };
  writeDrafts_(drafts);

  setStatus(`下書きを保存しました（番号：${no}）`);
  renderDraftList();
}

function loadDraftByNo(){
  const no = draftNo_();
  if(!no){ setStatus("下書き番号を入力してください。"); return; }

  const drafts = readDrafts_();
  if(!drafts[no]){ setStatus(`その番号の下書きがありません（番号：${no}）`); return; }

  applyDraftData_(drafts[no]);
  setStatus(`下書きを復元しました（番号：${no}）`);
}

function deleteDraftByNo(){
  const no = draftNo_();
  if(!no){ setStatus("下書き番号を入力してください。"); return; }

  const drafts = readDrafts_();
  if(!drafts[no]){ setStatus(`その番号の下書きがありません（番号：${no}）`); return; }

  if(!confirm(`下書き（番号：${no}）を削除しますか？`)) return;

  delete drafts[no];
  writeDrafts_(drafts);
  setStatus(`下書きを削除しました（番号：${no}）`);
  renderDraftList();
}

// 任意：自動保存（番号がある時だけ）
let draftTimer = null;
function autoSaveDraftByNo(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(()=>{
    const no = draftNo_();
    if(!no) return;

    const d = getDraftDataNow_();
    // ほぼ空なら保存しない
    const hasSomething = Object.keys(d).some(k => k!=="type" && String(d[k]||"").trim()!=="");
    if(!hasSomething) return;

    const drafts = readDrafts_();
    drafts[no] = { ...d, savedAt:new Date().toISOString() };
    writeDrafts_(drafts);
    renderDraftList();
  }, 500);
}

// ================================
// 送信
// ================================
function setSending_(sending){
  $("sendBtn").disabled = !!sending;
  $("clearBtn").disabled = !!sending;
}

async function send(){
  if(!GAS_URL || GAS_URL.includes("PASTE_GAS_WEBAPP_URL_HERE")){
    setStatus("GAS_URL が未設定です（script.js先頭）。");
    return;
  }

  setSending_(true);
  setStatus("送信準備中…");

  try{
    const payload = await getPayloadByType();
    const msg = validatePayload(payload);
    if(msg){
      setStatus(msg);
      return;
    }

    setStatus("送信中…");
    const body = JSON.stringify({ action:"submit", ...payload });

    const res = await fetch(GAS_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body
    });

    const text = await res.text();
    const data = JSON.parse(text);

    if(!data.ok){
      setStatus("失敗： " + (data.message || "unknown"));
      return;
    }

    setStatus(
      "送信しました。\n" +
      "起案番号： " + data.kianId + "\n" +
      "保存先： " + data.fileUrl
    );

    // 成功したら、該当番号の下書きを削除（任意）
    const no = draftNo_();
    if(no){
      const drafts = readDrafts_();
      if(drafts[no]){
        delete drafts[no];
        writeDrafts_(drafts);
        renderDraftList();
      }
    }

  }catch(err){
    setStatus("通信エラー： " + err);
  }finally{
    setSending_(false);
  }
}

// ================================
// クリア（区分ごと）
// ================================
function clearForm(){
  const t = $("type").value;

  if(t==="shishutsu"){
    ["s_kou","s_moku","s_setsu","s_amount","s_title","s_content","s_payee"].forEach(id=> $(id).value="");
    $("s_method").value = "口座振込";
  }else if(t==="shuunyuu"){
    ["r_kou","r_moku","r_setsu","r_amount","r_title","r_content","r_payer"].forEach(id=> $(id).value="");
    $("r_method").value = "口座振込";
  }else{
    ["g_title","g_content"].forEach(id=> $(id).value="");
    if($("g_file")) $("g_file").value = "";
  }

  setStatus("");
}

// ================================
// 初期化
// ================================
window.addEventListener("load", ()=>{
  applyTypeUI();

  $("type").addEventListener("change", ()=>{
    applyTypeUI();
    autoSaveDraftByNo();
  });

  $("sendBtn").addEventListener("click", send);
  $("clearBtn").addEventListener("click", clearForm);

  $("saveDraftBtn").addEventListener("click", saveDraftByNo);
  $("loadDraftBtn").addEventListener("click", loadDraftByNo);
  $("deleteDraftBtn").addEventListener("click", deleteDraftByNo);
  $("listDraftBtn").addEventListener("click", renderDraftList);

  // 自動保存対象
  [
    "draftNo","type",
    "s_kou","s_moku","s_setsu","s_amount","s_title","s_content","s_payee","s_method",
    "r_kou","r_moku","r_setsu","r_amount","r_title","r_content","r_payer","r_method",
    "g_title","g_content"
  ].forEach(id=>{
    const el = $(id);
    if(!el) return;
    el.addEventListener("input", autoSaveDraftByNo);
    el.addEventListener("change", autoSaveDraftByNo);
  });

  renderDraftList();
});
