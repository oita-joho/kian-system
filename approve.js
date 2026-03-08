// ================================
// approve.js
// 承認 + 差し戻し対応版
// ================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbwdXfLyVByUKJQOey9gbq7_Ra2lvzUu6nDwIbX1HFIUfWNsI7Gp4IbsjKiPpe93j_bd7g/exec";

function $(id){ return document.getElementById(id); }

function esc(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function setMsg(msg){
  if ($("msg")) $("msg").textContent = msg || "";
}

// ================================
// API
// ================================
async function api_(payload){
  const res = await fetch(GAS_URL,{
    method:"POST",
    headers:{
      "Content-Type":"text/plain;charset=utf-8"
    },
    body:JSON.stringify(payload)
  });

  const text = await res.text();

  try{
    return JSON.parse(text);
  }catch{
    throw new Error("JSONではない応答: " + text);
  }
}

// ================================
// 履歴文字列
// ================================
function makeApprovalsText_(item){
  const lines = [];

  if(item.approverA){
    lines.push(`A承認: ${item.approverA} / ${item.approvedAtA || ""} / ${item.commentA || ""}`);
  }

  if(item.approverB){
    lines.push(`B承認: ${item.approverB} / ${item.approvedAtB || ""} / ${item.commentB || ""}`);
  }

  if(item.returnedByA || item.returnCommentA){
    lines.push(`A差し戻し: ${item.returnedByA || ""} / ${item.returnedAtA || ""} / ${item.returnCommentA || ""}`);
  }

  if(item.returnedByB || item.returnCommentB){
    lines.push(`B差し戻し: ${item.returnedByB || ""} / ${item.returnedAtB || ""} / ${item.returnCommentB || ""}`);
  }

  if(item.returnedBy){
    lines.push(`差し戻し: ${item.returnedBy} / ${item.returnedAt || ""} / ${item.returnComment || ""}`);
  }

  if(lines.length === 0){
    return "まだ承認はありません";
  }

  return lines.join("\n");
}

// ================================
// PDFグリッド
// ================================
function makePdfGrid_(item){
  let html = `<div class="pdfGrid">`;

  if(item.pdfPreviewUrl){
    html += `
      <div class="pdfBox">
        <div class="pdfTitle">起案書PDF</div>
        <div class="meta">
          <a href="${esc(item.pdfUrl || "")}" target="_blank" rel="noopener noreferrer">PDFを開く</a>
        </div>
        <iframe
          class="pdfFrame"
          src="${esc(item.pdfPreviewUrl)}"
          loading="lazy"
          referrerpolicy="no-referrer">
        </iframe>
      </div>
    `;
  }

  if(Array.isArray(item.attachmentPreviewUrls) && item.attachmentPreviewUrls.length > 0){
    item.attachmentPreviewUrls.forEach((previewUrl, i) => {
      const fileUrl = Array.isArray(item.attachmentUrls) ? (item.attachmentUrls[i] || "") : "";
      html += `
        <div class="pdfBox">
          <div class="pdfTitle">添付PDF ${i + 1}</div>
          <div class="meta">
            <a href="${esc(fileUrl)}" target="_blank" rel="noopener noreferrer">PDFを開く</a>
          </div>
          <iframe
            class="pdfFrame"
            src="${esc(previewUrl)}"
            loading="lazy"
            referrerpolicy="no-referrer">
          </iframe>
        </div>
      `;
    });
  }

  html += `</div>`;
  return html;
}

// ================================
// カード作成
// ================================
function makeCard_(item){
  const aDone = !!item.approverA;
  const bDone = !!item.approverB;
  const pdfGrid = makePdfGrid_(item);

  return `
<div class="cardItem">
  <div class="cardHead">
    <div>
      <span class="badge">${esc(item.typeLabel || "")}</span>
      <span class="badge">整理番号: ${esc(item.seiriNo || "")}</span>
      <div class="kianId">起案番号: ${esc(item.kianId || "")}</div>
    </div>

    <div class="kianId">
      ${esc(item.createdAt || "")}
    </div>
  </div>

  <div class="title">${esc(item.title || "")}</div>

  <div class="content">${esc(item.content || "")}</div>

  <div class="meta">
    ${item.kou ? `<span>項: ${esc(item.kou)}</span>` : ""}
    ${item.moku ? `<span>目: ${esc(item.moku)}</span>` : ""}
    ${item.setsu ? `<span>節: ${esc(item.setsu)}</span>` : ""}
    ${item.amount ? `<span>金額: ${esc(item.amount)}</span>` : ""}
    ${item.payee ? `<span>支払先: ${esc(item.payee)}</span>` : ""}
    ${item.payer ? `<span>納入者: ${esc(item.payer)}</span>` : ""}
    ${item.method ? `<span>方法: ${esc(item.method)}</span>` : ""}
  </div>

  ${pdfGrid}

  <div class="attachItem">
    <div class="attachTitle">承認履歴</div>
    <pre class="draftList">${esc(makeApprovalsText_(item))}</pre>
  </div>

  <div class="twoApprovers">
    <div class="approverBox ${aDone ? "doneBox" : ""}">
      <strong>承認者A</strong>

      <label>氏名</label>
      <input
        id="nameA_${esc(item.kianId)}"
        type="text"
        placeholder="会長名を入力"
        ${aDone ? "disabled" : ""}
      >

      <label>コメント</label>
      <textarea
        id="commentA_${esc(item.kianId)}"
        rows="3"
        ${aDone ? "disabled" : ""}
      ></textarea>

      <div class="btnRow">
        <button
          class="approveBtn ${aDone ? "doneBtn" : ""}"
          ${aDone ? "disabled" : ""}
          onclick="${aDone ? "" : `approveOne('${esc(item.kianId)}','A')`}"
        >
          ${aDone ? "A承認済" : "Aとして承認"}
        </button>

        <button
          class="returnBtn"
          ${aDone ? "disabled" : ""}
          onclick="${aDone ? "" : `returnOne('${esc(item.kianId)}','A')`}"
        >
          Aとして差し戻し
        </button>
      </div>
    </div>

    <div class="approverBox ${bDone ? "doneBox" : ""}">
      <strong>承認者B</strong>

      <label>氏名</label>
      <input
        id="nameB_${esc(item.kianId)}"
        type="text"
        placeholder="理事長名を入力"
        ${bDone ? "disabled" : ""}
      >

      <label>コメント</label>
      <textarea
        id="commentB_${esc(item.kianId)}"
        rows="3"
        ${bDone ? "disabled" : ""}
      ></textarea>

      <div class="btnRow">
        <button
          class="approveBtn ${bDone ? "doneBtn" : ""}"
          ${bDone ? "disabled" : ""}
          onclick="${bDone ? "" : `approveOne('${esc(item.kianId)}','B')`}"
        >
          ${bDone ? "B承認済" : "Bとして承認"}
        </button>

        <button
          class="returnBtn"
          ${bDone ? "disabled" : ""}
          onclick="${bDone ? "" : `returnOne('${esc(item.kianId)}','B')`}"
        >
          Bとして差し戻し
        </button>
      </div>
    </div>
  </div>
</div>
`;
}

// ================================
// 一覧取得
// ================================
async function loadList(){
  setMsg("読み込み中...");

  try{
    const data = await api_({
      action:"list",
      status:"pending",
      limit:50
    });

    if(!data.ok){
      setMsg("失敗: " + (data.message || "unknown"));
      return;
    }

    const box = $("cards");

    if(!data.items || data.items.length === 0){
      box.innerHTML = "承認待ちはありません";
      setMsg("");
      return;
    }

    box.innerHTML = data.items.map(makeCard_).join("");
    setMsg("");

  }catch(err){
    setMsg("エラー: " + err);
  }
}

// ================================
// 承認
// ================================
async function approveOne(kianId, side){
  const name = $(`name${side}_${kianId}`).value.trim();
  const comment = $(`comment${side}_${kianId}`).value.trim();

  if(!name){
    alert("名前を入力してください");
    return;
  }

  setMsg("承認送信中...");

  try{
    const data = await api_({
      action:"approve",
      kianId,
      side,
      approverName:name,
      comment
    });

    if(!data.ok){
      setMsg("失敗: " + (data.message || "unknown"));
      return;
    }

    setMsg("承認しました");
    await loadList();

  }catch(err){
    setMsg("エラー: " + err);
  }
}

// ================================
// 差し戻し
// ================================
async function returnOne(kianId, side){
  const name = $(`name${side}_${kianId}`).value.trim();
  const comment = $(`comment${side}_${kianId}`).value.trim();

  if(!name){
    alert("名前を入力してください");
    return;
  }

  if(!comment){
    alert("差し戻しコメントを入力してください");
    return;
  }

  if(!confirm("この起案を差し戻しますか？")){
    return;
  }

  setMsg("差し戻し送信中...");

  try{
    const data = await api_({
      action:"return",
      kianId,
      side,
      approverName:name,
      comment
    });

    if(!data.ok){
      setMsg("失敗: " + (data.message || "unknown"));
      return;
    }

    setMsg("差し戻しました");
    await loadList();

  }catch(err){
    setMsg("エラー: " + err);
  }
}

window.approveOne = approveOne;
window.returnOne = returnOne;
window.addEventListener("load", loadList);
