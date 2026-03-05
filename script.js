// ================================
// script.js（下書き復活 + 送信）
// ================================

// ★ここをGASのWebアプリURLに差し替え
const GAS_URL = "https://script.google.com/macros/s/AKfycbxF0N73CTWMaE4WVWCa8wkojtmtARi20cVh5SPo0ENyG7ZTBM8saN0Kn9Kf2cdC6SNU/exec";

function $(id){ return document.getElementById(id); }
function setStatus(msg){ $("status").textContent = msg || ""; }
function v(id){ return ($(id)?.value || "").trim(); }

// ---------------- UI: type switch ----------------
function applyTypeUI(){
  const t = $("type").value;
  $("form_shishutsu").style.display = (t==="shishutsu") ? "" : "none";
  $("form_shuunyuu").style.display  = (t==="shuunyuu")  ? "" : "none";
  $("form_ringi").style.display     = (t==="ringi")     ? "" : "none";
}

// ---------------- validation ----------------
// ※項・目・節は必須にしない（ユーザー要望）
function validate(payload){
  if(payload.type==="shishutsu"){
    if(!payload.title) return "未入力：件名";
    if(!payload.content) return "未入力：内容";
    if(!payload.amount) return "未入力：支出金額";
    if(!payload.payee) return "未入力：支払先";
    return "";
  }
  if(payload.type==="shuunyuu"){
    if(!payload.title) return "未入力：件名";
    if(!payload.content) return "未入力：内容";
    if(!payload.amount) return "未入力：収入金額";
    if(!payload.payer) return "未入力：納入者";
    return "";
  }
  // ringi
  if(!payload.title) return "未入力：件名";
  if(!payload.content) return "未入力：内容";
  return "";
}

// ---------------- attachment ----------------
function readFileAsDataURL(file){
  return new Promise((resolve,reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(r.result);
    r.onerror = (e)=> reject(e);
    r.readAsDataURL(file);
  });
}

// ---------------- payload ----------------
async function buildPayload(){
  const type = $("type").value;

  if(type==="shishutsu"){
    return {
      action:"submit",
      type,
      label:"支出負担行為",
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

  if(type==="shuunyuu"){
    return {
      action:"submit",
      type,
      label:"収入行為",
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
    action:"submit",
    type,
    label:"稟議行為",
    title: v("g_title"),
    content: v("g_content"),
    attachment: null
  };

  const file = $("g_file")?.files?.[0] || null;
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

// ---------------- send ----------------
function setSending(sending){
  $("sendBtn").disabled = !!sending;
}

async function send(){
  if(!GAS_URL || GAS_URL.includes("PASTE_GAS_WEBAPP_URL_HERE")){
    setStatus("GAS_URL が未設定です（script.js先頭）。");
    return;
  }

  setSending(true);
  setStatus("送信準備中…");

  try{
    const payload = await buildPayload();
    const msg = validate(payload);
    if(msg){ setStatus(msg); return; }

    setStatus("送信中…");
    const res = await fetch(GAS_URL, {
      method:"POST",
      headers:{ "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try{ data = JSON.parse(text); }
    catch{ throw new Error("GASの返却がJSONではありません: " + text); }

    if(!data.ok){
      setStatus("失敗： " + (data.message || "unknown"));
      return;
    }

    setStatus(
      "送信しました。\n" +
      "起案番号： " + (data.kianId || "") + "\n" +
      "保存先： " + (data.fileUrl || "")
    );

    // 送信成功したら、該当番号の下書きがあれば削除（任意）
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
    setSending(false);
  }
}

// ---------------- clear ----------------
function clearForm(){
  const t = $("type").value;

  if(t==="shishutsu"){
    ["s_kou","s_moku","s_setsu","s_title","s_content","s_amount","s_payee"].forEach(id=> $(id).value="");
    $("s_method").value = "口座振込";
  }else if(t==="shuunyuu"){
    ["r_kou","r_moku","r_setsu","r_title","r_content","r_amount","r_payer"].forEach(id=> $(id).value="");
    $("r_method").value = "口座振込";
  }else{
    ["g_title","g_content"].forEach(id=> $(id).value="");
    if($("g_file")) $("g_file").value = "";
  }

  setStatus("");
}

// ======================================================
// 下書き（番号で複数保存）
// ======================================================
const DRAFTS_KEY = "kian_drafts_multi_v3";

function draftNo_(){ return v("draftNo"); }

function readDrafts_(){
  const raw = localStorage.getItem(DRAFTS_KEY);
  if(!raw) return {};
  try{ return JSON.parse(raw); }catch{ return {}; }
}

function writeDrafts_(obj){
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(obj));
}

function getDraftDataNow_(){
  const type = $("type").value;
  const base = { type, savedAt: new Date().toISOString() };

  if(type==="shishutsu"){
    return {
      ...base,
      s_kou:v("s_kou"), s_moku:v("s_moku"), s_setsu:v("s_setsu"),
      s_title:v("s_title"), s_content:v("s_content"),
      s_amount:v("s_amount"), s_payee:v("s_payee"),
      s_method:$("s_method").value || ""
    };
  }
  if(type==="shuunyuu"){
    return {
      ...base,
      r_kou:v("r_kou"), r_moku:v("r_moku"), r_setsu:v("r_setsu"),
      r_title:v("r_title"), r_content:v("r_content"),
      r_amount:v("r_amount"), r_payer:v("r_payer"),
      r_method:$("r_method").value || ""
    };
  }
  // ringi（添付は保存しない）
  return {
    ...base,
    g_title:v("g_title"),
    g_content:v("g_content")
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
    $("s_title").value = d.s_title || "";
    $("s_content").value = d.s_content || "";
    $("s_amount").value = d.s_amount || "";
    $("s_payee").value = d.s_payee || "";
    $("s_method").value = d.s_method || "口座振込";
  }else if(d.type==="shuunyuu"){
    $("r_kou").value = d.r_kou || "";
    $("r_moku").value = d.r_moku || "";
    $("r_setsu").value = d.r_setsu || "";
    $("r_title").value = d.r_title || "";
    $("r_content").value = d.r_content || "";
    $("r_amount").value = d.r_amount || "";
    $("r_payer").value = d.r_payer || "";
    $("r_method").value = d.r_method || "口座振込";
  }else{
    $("g_title").value = d.g_title || "";
    $("g_content").value = d.g_content || "";
    if($("g_file")) $("g_file").value = "";
  }
}

function renderDraftList(){
  const box = $("draftList");
  const drafts = readDrafts_();
  const keys = Object.keys(drafts);

  if(keys.length===0){
    box.textContent = "（下書きはありません）";
    return;
  }

  keys.sort((a,b)=> (drafts[b]?.savedAt||"").localeCompare(drafts[a]?.savedAt||""));

  const typeLabel = (t)=> t==="shishutsu" ? "支出" : t==="shuunyuu" ? "収入" : "稟議";

  box.textContent = keys.map(k=>{
    const d = drafts[k] || {};
    const at = (d.savedAt||"").replace("T"," ").slice(0,19);
    const title =
      d.type==="shishutsu" ? (d.s_title||"") :
      d.type==="shuunyuu" ? (d.r_title||"") :
      (d.g_title||"");
    return `#${k}  ${at}  [${typeLabel(d.type)}]  ${String(title).slice(0,24)}`;
  }).join("\n");
}

function saveDraftByNo(){
  const no = draftNo_();
  if(!no){ setStatus("下書き番号を入力してください。"); return; }

  const drafts = readDrafts_();
  drafts[no] = getDraftDataNow_();
  writeDrafts_(drafts);

  setStatus(`下書きを保存しました（番号：${no}）`);
  renderDraftList();
}

function loadDraftByNo(){
  const no = draftNo_();
  if(!no){ setStatus("下書き番号を入力してください。"); return; }

  const drafts = readDrafts_();
  if(!drafts[no]){
    setStatus(`その番号の下書きがありません（番号：${no}）`);
    return;
  }

  applyDraftData_(drafts[no]);
  setStatus(`下書きを復元しました（番号：${no}）`);
}

function deleteDraftByNo(){
  const no = draftNo_();
  if(!no){ setStatus("下書き番号を入力してください。"); return; }

  const drafts = readDrafts_();
  if(!drafts[no]){
    setStatus(`その番号の下書きがありません（番号：${no}）`);
    return;
  }

  if(!confirm(`下書き（番号：${no}）を削除しますか？`)) return;

  delete drafts[no];
  writeDrafts_(drafts);

  setStatus(`下書きを削除しました（番号：${no}）`);
  renderDraftList();
}

// 入力があったら軽く自動保存（番号が入っている時だけ）
let draftTimer = null;
function autoSaveDraft(){
  clearTimeout(draftTimer);
  draftTimer = setTimeout(()=>{
    const no = draftNo_();
    if(!no) return;

    const d = getDraftDataNow_();
    // ほぼ空なら保存しない
    const hasSomething = Object.keys(d).some(k=>{
      if(["type","savedAt"].includes(k)) return false;
      return String(d[k]||"").trim() !== "";
    });
    if(!hasSomething) return;

    const drafts = readDrafts_();
    drafts[no] = d;
    writeDrafts_(drafts);
    renderDraftList();
  }, 500);
}

// ---------------- init ----------------
window.addEventListener("load", ()=>{
  applyTypeUI();
  renderDraftList();

  $("type").addEventListener("change", ()=>{ applyTypeUI(); autoSaveDraft(); });

  $("sendBtn").addEventListener("click", send);
  $("clearBtn").addEventListener("click", clearForm);

  $("saveDraftBtn").addEventListener("click", saveDraftByNo);
  $("loadDraftBtn").addEventListener("click", loadDraftByNo);
  $("deleteDraftBtn").addEventListener("click", deleteDraftByNo);
  $("listDraftBtn").addEventListener("click", renderDraftList);

  // 入力監視（自動下書き）
  [
    "draftNo","type",
    "s_kou","s_moku","s_setsu","s_title","s_content","s_amount","s_payee","s_method",
    "r_kou","r_moku","r_setsu","r_title","r_content","r_amount","r_payer","r_method",
    "g_title","g_content"
  ].forEach(id=>{
    const el = $(id);
    if(!el) return;
    el.addEventListener("input", autoSaveDraft);
    el.addEventListener("change", autoSaveDraft);
  });
});
