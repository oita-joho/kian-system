// ================================
// script.js
// スプレッドシート下書き一覧・復元・削除対応版
// ================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbxfuFEkPyAfhyiN6Ai5KDi-7fkpFAOfZmQcEMKdoZq7jVm2me6GJu9mxYAk28KjmjTIpA/exec";

function $(id){ return document.getElementById(id); }
function v(id){ return ($(id)?.value || "").trim(); }
function setStatus(msg){ $("status").textContent = msg || ""; }

let selectedFiles = [];
let draftItemsCache = [];

// ================================
// UI切替
// ================================
function applyTypeUI(){
  const t = $("type").value;
  $("form_shishutsu").style.display = (t === "shishutsu") ? "" : "none";
  $("form_shuunyuu").style.display  = (t === "shuunyuu")  ? "" : "none";
  $("form_ringi").style.display     = (t === "ringi")     ? "" : "none";
}

// ================================
// 整理番号制御
// ================================
function bindSeiriNoRule(){
  const seiri = $("seiriNo");
  if(!seiri) return;

  seiri.addEventListener("input", function(){
    this.value = this.value.replace(/[^0-9]/g, "");
    this.value = this.value.replace(/^0+/, "");
  });
}

// ================================
// バリデーション
// ================================
function validate(payload){
  if(!payload.type) return "未入力：区分";
  if(!payload.seiriNo) return "未入力：整理番号";
  if(!/^[1-9][0-9]*$/.test(payload.seiriNo)){
    return "整理番号は1以上の半角数字です（先頭0不可）";
  }

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

  if(payload.attachments.length > 5) return "添付は5件までです";
  return "";
}

// ================================
// API
// ================================
async function api_(payload){
  const res = await fetch(GAS_URL, {
    method: "POST",
    headers: { "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });

  const text = await res.text();
  try{
    return JSON.parse(text);
  }catch{
    throw new Error("GASの応答がJSONではありません: " + text);
  }
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
// 添付表示
// ================================
function escapeHtml_(s){
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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
    setStatus("追加するファイルを選んでください。");
    return;
  }

  if(selectedFiles.length >= 5){
    setStatus("添付は最大5件です。");
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

// ================================
// 送信データ
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
    throw new Error("添付は5件までです");
  }

  for (const file of selectedFiles) {
    const dataUrl = await readFileAsDataURL(file);
    payload.attachments.push({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
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

    const data = await api_(payload);

    if(!data.ok){
      setStatus("失敗: " + (data.message || "unknown"));
      return;
    }

    setStatus(
      "送信しました。\n" +
      "整理番号: " + (data.seiriNo || "") + "\n" +
      "起案番号: " + (data.kianId || "") + "\n" +
      "起案書PDF: " + (data.pdfUrl || "") + "\n" +
      "添付件数: " + (data.attachmentCount ?? 0)
    );

    // 下書き番号があれば draft を削除
    const no = draftNo_();
    if(no){
      try{
        await api_({
          action: "deleteDraft",
          draftNo: no
        });
      }catch(e){}
    }

    await loadDraftsFromSheet();

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
  if($("draftNo")) $("draftNo").value = "";

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
// 下書き保存・復元・削除
// ================================
function draftNo_(){
  return v("draftNo");
}

function typeLabelJa_(t){
  if(t === "shishutsu") return "支出";
  if(t === "shuunyuu") return "収入";
  return "稟議";
}

function fillFormFromDraft_(d){
  if(!d) return;

  clearForm();

  if($("draftNo")) $("draftNo").value = d.draftNo || "";
  if($("seiriNo")) $("seiriNo").value = d.seiriNo || "";
  if($("type")) $("type").value = d.type || "";
  applyTypeUI();

  if(d.type === "shishutsu"){
    if($("s_kou")) $("s_kou").value = d.kou || "";
    if($("s_moku")) $("s_moku").value = d.moku || "";
    if($("s_setsu")) $("s_setsu").value = d.setsu || "";
    if($("s_title")) $("s_title").value = d.title || "";
    if($("s_content")) $("s_content").value = d.content || "";
    if($("s_amount")) $("s_amount").value = d.amount || "";
    if($("s_payee")) $("s_payee").value = d.payee || "";
    if($("s_method")) $("s_method").value = d.method || "口座振込";
  }

  if(d.type === "shuunyuu"){
    if($("r_kou")) $("r_kou").value = d.kou || "";
    if($("r_moku")) $("r_moku").value = d.moku || "";
    if($("r_setsu")) $("r_setsu").value = d.setsu || "";
    if($("r_title")) $("r_title").value = d.title || "";
    if($("r_content")) $("r_content").value = d.content || "";
    if($("r_amount")) $("r_amount").value = d.amount || "";
    if($("r_payer")) $("r_payer").value = d.payer || "";
    if($("r_method")) $("r_method").value = d.method || "口座振込";
  }

  if(d.type === "ringi"){
    if($("g_title")) $("g_title").value = d.title || "";
    if($("g_content")) $("g_content").value = d.content || "";
  }

  setStatus(`下書きを復元しました（番号：${d.draftNo || ""}）`);
}

async function saveDraftByNo(){
  const no = draftNo_();
  if(!no){
    setStatus("下書き番号を入力してください。");
    return;
  }

  try{
    const payload = await buildPayload();
    payload.action = "saveDraft";
    payload.draftNo = no;
    payload.attachments = []; // 下書きには添付を含めない

    const data = await api_(payload);

    if(!data.ok){
      setStatus("下書き保存失敗: " + (data.message || "unknown"));
      return;
    }

    setStatus(`下書きをスプレッドシートに保存しました（番号：${no}）`);
    await loadDraftsFromSheet();
  }catch(err){
    setStatus("下書き保存エラー: " + err);
  }
}

async function loadDraftByNo(){
  const no = draftNo_();
  if(!no){
    setStatus("下書き番号を入力してください。");
    return;
  }

  if(draftItemsCache.length === 0){
    await loadDraftsFromSheet();
  }

  const item = draftItemsCache.find(d => String(d.draftNo) === String(no));
  if(!item){
    setStatus(`その番号の下書きがありません（番号：${no}）`);
    return;
  }

  fillFormFromDraft_(item);
}

async function deleteDraftByNo(){
  const no = draftNo_();
  if(!no){
    setStatus("下書き番号を入力してください。");
    return;
  }

  if(!confirm(`下書き（番号：${no}）を削除しますか？`)) return;

  try{
    const data = await api_({
      action: "deleteDraft",
      draftNo: no
    });

    if(!data.ok){
      setStatus("下書き削除失敗: " + (data.message || "unknown"));
      return;
    }

    setStatus(`下書きを削除しました（番号：${no}）`);
    await loadDraftsFromSheet();
  }catch(err){
    setStatus("下書き削除エラー: " + err);
  }
}

// ================================
// 下書き一覧（シート）
// ================================
function renderDraftsFromSheet(items){
  const box = $("draftSheetList");
  if(!box) return;

  draftItemsCache = Array.isArray(items) ? items : [];

  if(draftItemsCache.length === 0){
    box.innerHTML = "（下書きはありません）";
    return;
  }

  box.innerHTML = draftItemsCache.map((d, i) => `
    <div class="sheetDraftCard">
      <div class="sheetDraftMeta">
        <span>下書き番号: ${escapeHtml_(d.draftNo || "")}</span>
        <span>区分: ${escapeHtml_(d.typeLabel || typeLabelJa_(d.type))}</span>
        <span>整理番号: ${escapeHtml_(d.seiriNo || "")}</span>
        <span>更新: ${escapeHtml_(d.updatedAt || d.createdAt || "")}</span>
      </div>
      <div class="sheetDraftTitleText">${escapeHtml_(d.title || "（件名なし）")}</div>
      <div class="sheetDraftButtons">
        <button type="button" class="miniBtn miniPrimary" onclick="restoreDraftFromList(${i})">復元</button>
        <button type="button" class="miniBtn miniDanger" onclick="deleteDraftFromList(${i})">削除</button>
      </div>
    </div>
  `).join("");
}

async function loadDraftsFromSheet(){
  const box = $("draftSheetList");
  if(box) box.textContent = "読み込み中...";

  try{
    const data = await api_({
      action: "listDrafts"
    });

    if(!data.ok){
      if(box) box.textContent = "読み込み失敗";
      return;
    }

    renderDraftsFromSheet(data.items || []);
  }catch(err){
    if(box) box.textContent = "読み込み失敗";
    console.error(err);
  }
}

function restoreDraftFromList(index){
  const item = draftItemsCache[index];
  if(!item) return;
  fillFormFromDraft_(item);
}

async function deleteDraftFromList(index){
  const item = draftItemsCache[index];
  if(!item) return;

  if(!confirm(`下書き（番号：${item.draftNo}）を削除しますか？`)) return;

  try{
    const data = await api_({
      action: "deleteDraft",
      draftNo: item.draftNo
    });

    if(!data.ok){
      setStatus("下書き削除失敗: " + (data.message || "unknown"));
      return;
    }

    setStatus(`下書きを削除しました（番号：${item.draftNo}）`);
    await loadDraftsFromSheet();
  }catch(err){
    setStatus("下書き削除エラー: " + err);
  }
}

// ================================
// 初期化
// ================================
window.addEventListener("load", async ()=>{
  applyTypeUI();
  bindSeiriNoRule();
  renderSelectedFiles();

  $("type").addEventListener("change", applyTypeUI);
  $("sendBtn").addEventListener("click", send);
  $("clearBtn").addEventListener("click", clearForm);

  $("saveDraftBtn").addEventListener("click", saveDraftByNo);
  $("listDraftBtn").addEventListener("click", loadDraftsFromSheet);

  if($("addFileBtn")) $("addFileBtn").addEventListener("click", addSelectedFile);
  if($("clearFilesBtn")) $("clearFilesBtn").addEventListener("click", clearSelectedFiles);

  await loadDraftsFromSheet();
});
