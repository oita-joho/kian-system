// ================================
// script.js
// 1件ずつ添付追加版
// ================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzbZsJ-VBpqwUkAkz73x9mUALE0CyBweSCE14uGw1bgCRqb8c6y08asj81ABJzYONKP4w/exec";

function $(id){ return document.getElementById(id); }
function v(id){ return ($(id)?.value || "").trim(); }
function setStatus(msg){ $("status").textContent = msg || ""; }

// 1件ずつ追加した添付PDFを保持
let selectedFiles = [];

// ================================
// 区分切替
// ================================
function applyTypeUI(){
  const t = $("type").value;
  $("form_shishutsu").style.display = (t === "shishutsu") ? "" : "none";
  $("form_shuunyuu").style.display  = (t === "shuunyuu")  ? "" : "none";
  $("form_ringi").style.display     = (t === "ringi")     ? "" : "none";
}

// ================================
// バリデーション
// ================================
function validate(payload){
  if(!payload.type) return "未入力：区分";
  if(!payload.seiriNo) return "未入力：整理番号";

  if(payload.type === "shishutsu"){
    if(!payload.title) return "未入力：件名";
    if(!payload.content) return "未入力：内容";
    if(!payload.amount) return "未入力：支出金額";
    if(!payload.payee) return "未入力：支払先";
  } else if(payload.type === "shuunyuu"){
    if(!payload.title) return "未入力：件名";
    if(!payload.content) return "未入力：内容";
    if(!payload.amount) return "未入力：収入金額";
    if(!payload.payer) return "未入力：納入者";
  } else if(payload.type === "ringi"){
    if(!payload.title) return "未入力：件名";
    if(!payload.content) return "未入力：内容";
  }

  if(payload.attachments.length > 5) return "添付PDFは5件までです";
  return "";
}

// ================================
// File -> DataURL
// ================================
function readFileAsDataURL(file){
  return new Promise((resolve, reject)=>{
    const r = new FileReader();
    r.onload = ()=> resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// ================================
// 添付ファイル表示
// ================================
function renderSelectedFiles(){
  const box = $("fileList");
  if(!box) return;

  if(selectedFiles.length === 0){
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

function removeSelectedFile(index){
  selectedFiles.splice(index, 1);
  renderSelectedFiles();
  setStatus(`添付を削除しました（${selectedFiles.length}件）`);
}

function addSelectedFile(){
  const input = $("fileOne");
  const file = input?.files?.[0];

  if(!file){
    setStatus("追加するPDFを選んでください。");
    return;
  }

  if(file.type !== "application/pdf"){

  }

  if(selectedFiles.length >= 5){
    setStatus("添付PDFは最大5件です。");
    input.value = "";
    return;
  }

  const duplicated = selectedFiles.some(f =>
    f.name === file.name &&
    f.size === file.size &&
    f.lastModified === file.lastModified
  );

  if(duplicated){
    setStatus("同じファイルは追加済みです。");
    input.value = "";
    return;
  }

  selectedFiles.push(file);
  input.value = "";
  renderSelectedFiles();
  setStatus(`添付を追加しました（${selectedFiles.length}件）`);
}

function clearSelectedFiles(){
  selectedFiles = [];
  if($("fileOne")) $("fileOne").value = "";
  renderSelectedFiles();
  setStatus("添付を全削除しました。");
}

// HTML表示用の最小エスケープ
function escapeHtml_(s){
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ================================
// 送信データ組み立て
// ================================
async function buildPayload(){
  const type = $("type").value;
  const seiriNo = $("seiriNo") ? $("seiriNo").value.trim() : "";

  const payload = {
    action: "submit",
    type,
    seiriNo,
    label: $("type").selectedOptions[0]?.text || "",
    attachments: []
  };

  if(type === "shishutsu"){
    payload.title = v("s_title");
    payload.content = v("s_content");
    payload.kou = v("s_kou");
    payload.moku = v("s_moku");
    payload.setsu = v("s_setsu");
    payload.amount = v("s_amount");
    payload.payee = v("s_payee");
    payload.method = $("s_method").value || "";
  }

  if(type === "shuunyuu"){
    payload.title = v("r_title");
    payload.content = v("r_content");
    payload.kou = v("r_kou");
    payload.moku = v("r_moku");
    payload.setsu = v("r_setsu");
    payload.amount = v("r_amount");
    payload.payer = v("r_payer");
    payload.method = $("r_method").value || "";
  }

  if(type === "ringi"){
    payload.title = v("g_title");
    payload.content = v("g_content");
  }

  if(selectedFiles.length > 5){
    throw new Error("PDFは5件までです");
  }

  for (const file of selectedFiles) {
    const dataUrl = await readFileAsDataURL(file);
    payload.attachments.push({
      fileName: file.name,
      mimeType: file.type,
      dataUrl
    });
  }

  return payload;
}

// ================================
// 送信
// ================================
function setSending(flag){
  $("sendBtn").disabled = !!flag;
}

async function send(){
  if(!GAS_URL || GAS_URL.includes("YOUR_GAS_WEBAPP_URL")){
    setStatus("GAS_URL を設定してください。");
    return;
  }

  setSending(true);
  setStatus("送信中…");

  try{
    const payload = await buildPayload();
    const msg = validate(payload);
    if(msg){
      setStatus(msg);
      return;
    }

    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type":"text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let data;
    try{
      data = JSON.parse(text);
    }catch{
      throw new Error("GASの応答がJSONではありません: " + text);
    }

    if(!data.ok){
      setStatus("失敗: " + (data.message || "unknown"));
      return;
    }

    setStatus(
      "送信しました。\n" +
      "整理番号: " + (data.seiriNo || "") + "\n" +
      "起案番号: " + (data.kianId || "") + "\n" +
      "起案書PDF: " + (data.pdfUrl || "") + "\n" +
      "添付PDF件数: " + (data.attachmentCount ?? 0)
    );

    const no = draftNo_();
    if(no){
      const drafts = readDrafts_();
      if(drafts[no]){
        delete drafts[no];
        writeDrafts_(drafts);
      }
    }

  }catch(err){
    setStatus("通信エラー: " + err);
  }finally{
    setSending(false);
  }
}

// ================================
// クリア
// ================================
function clearForm(){
  if($("type")) $("type").value = "";
  if($("seiriNo")) $("seiriNo").value = "";

  [
    "s_kou","s_moku","s_setsu","s_title","s_content","s_amount","s_payee",
    "r_kou","r_moku","r_setsu","r_title","r_content","r_amount","r_payer",
    "g_title","g_content"
  ].forEach(id=>{
    if($(id)) $(id).value = "";
  });

  if($("s_method")) $("s_method").value = "口座振込";
  if($("r_method")) $("r_method").value = "口座振込";

  selectedFiles = [];
  if($("fileOne")) $("fileOne").value = "";
  renderSelectedFiles();

  applyTypeUI();
  setStatus("");
}

// ================================
// 下書き
// ================================
const DRAFTS_KEY = "kian_drafts_multi_v8";

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
  const base = {
    type,
    seiriNo: v("seiriNo"),
    savedAt: new Date().toISOString()
  };

  if(type === "shishutsu"){
    return {
      ...base,
      s_kou:v("s_kou"),
      s_moku:v("s_moku"),
      s_setsu:v("s_setsu"),
      s_title:v("s_title"),
      s_content:v("s_content"),
      s_amount:v("s_amount"),
      s_payee:v("s_payee"),
      s_method:$("s_method").value || ""
    };
  }

  if(type === "shuunyuu"){
    return {
      ...base,
      r_kou:v("r_kou"),
      r_moku:v("r_moku"),
      r_setsu:v("r_setsu"),
      r_title:v("r_title"),
      r_content:v("r_content"),
      r_amount:v("r_amount"),
      r_payer:v("r_payer"),
      r_method:$("r_method").value || ""
    };
  }

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
  if($("seiriNo")) $("seiriNo").value = d.seiriNo || "";

  if(d.type === "shishutsu"){
    $("s_kou").value = d.s_kou || "";
    $("s_moku").value = d.s_moku || "";
    $("s_setsu").value = d.s_setsu || "";
    $("s_title").value = d.s_title || "";
    $("s_content").value = d.s_content || "";
    $("s_amount").value = d.s_amount || "";
    $("s_payee").value = d.s_payee || "";
    $("s_method").value = d.s_method || "口座振込";
  } else if(d.type === "shuunyuu"){
    $("r_kou").value = d.r_kou || "";
    $("r_moku").value = d.r_moku || "";
    $("r_setsu").value = d.r_setsu || "";
    $("r_title").value = d.r_title || "";
    $("r_content").value = d.r_content || "";
    $("r_amount").value = d.r_amount || "";
    $("r_payer").value = d.r_payer || "";
    $("r_method").value = d.r_method || "口座振込";
  } else {
    $("g_title").value = d.g_title || "";
    $("g_content").value = d.g_content || "";
  }
}

function renderDraftList(){
  const box = $("draftList");
  const drafts = readDrafts_();
  const keys = Object.keys(drafts);

  if(keys.length === 0){
    box.textContent = "（下書きはありません）";
    return;
  }

  keys.sort((a,b)=> (drafts[b]?.savedAt || "").localeCompare(drafts[a]?.savedAt || ""));

  const typeLabel = t => t === "shishutsu" ? "支出" : t === "shuunyuu" ? "収入" : "稟議";

  box.textContent = keys.map(k=>{
    const d = drafts[k] || {};
    const at = (d.savedAt || "").replace("T"," ").slice(0,19);
    const title =
      d.type === "shishutsu" ? (d.s_title || "") :
      d.type === "shuunyuu" ? (d.r_title || "") :
      (d.g_title || "");
    return `#${k}  ${at}  [${typeLabel(d.type)}] No:${d.seiriNo || ""}  ${String(title).slice(0,24)}`;
  }).join("\n");
}

function saveDraftByNo(){
  const no = draftNo_();
  if(!no){
    setStatus("下書き番号を入力してください。");
    return;
  }
  const drafts = readDrafts_();
  drafts[no] = getDraftDataNow_();
  writeDrafts_(drafts);
  setStatus(`下書きを保存しました（番号：${no}）`);
}

function loadDraftByNo(){
  const no = draftNo_();
  if(!no){
    setStatus("下書き番号を入力してください。");
    return;
  }
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
  if(!no){
    setStatus("下書き番号を入力してください。");
    return;
  }
  const drafts = readDrafts_();
  if(!drafts[no]){
    setStatus(`その番号の下書きがありません（番号：${no}）`);
    return;
  }
  if(!confirm(`下書き（番号：${no}）を削除しますか？`)) return;

  delete drafts[no];
  writeDrafts_(drafts);
  setStatus(`下書きを削除しました（番号：${no}）`);
  $("draftList").textContent = "";
}

// ================================
// 初期化
// ================================
window.addEventListener("load", ()=>{
  applyTypeUI();

  if($("draftList")) $("draftList").textContent = "";
  renderSelectedFiles();

  $("type").addEventListener("change", applyTypeUI);
  $("sendBtn").addEventListener("click", send);
  $("clearBtn").addEventListener("click", clearForm);

  $("saveDraftBtn").addEventListener("click", saveDraftByNo);
  $("loadDraftBtn").addEventListener("click", loadDraftByNo);
  $("deleteDraftBtn").addEventListener("click", deleteDraftByNo);
  $("listDraftBtn").addEventListener("click", renderDraftList);

  if($("addFileBtn")) $("addFileBtn").addEventListener("click", addSelectedFile);
  if($("clearFilesBtn")) $("clearFilesBtn").addEventListener("click", clearSelectedFiles);
});
