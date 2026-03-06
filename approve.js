// ================================
// approve.js
// ================================
const GAS_URL = "https://script.google.com/macros/s/AKfycbzbZsJ-VBpqwUkAkz73x9mUALE0CyBweSCE14uGw1bgCRqb8c6y08asj81ABJzYONKP4w/exec";
function $(id){ return document.getElementById(id); }

function esc(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

function setMsg(msg){
  $("msg").textContent = msg || "";
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
    throw new Error("JSONではない応答: "+text);
  }
}

// ================================
// 添付HTML
// ================================

function makeAttachmentHtml_(urls, previews){

  if(!Array.isArray(urls) || urls.length===0){
    return "";
  }

  let html="";

  urls.forEach((url,i)=>{

    const preview = Array.isArray(previews) ? previews[i] : "";

    html+=`
    <div class="attachItem">

      <div class="attachTitle">
      添付PDF ${i+1}
      </div>

      <div class="meta">
        <a href="${esc(url)}" target="_blank">
        PDFを開く
        </a>
      </div>

      ${
        preview
        ?
        `<iframe class="pdfFrame" src="${esc(preview)}"></iframe>`
        :
        ``
      }

    </div>
    `;

  });

  return html;
}

// ================================
// 承認履歴
// ================================

function makeApprovalsText_(item){

  const lines=[];

  if(item.approverA){
    lines.push(
      `A: ${item.approverA} / ${item.approvedAtA || ""} / ${item.commentA || ""}`
    );
  }

  if(item.approverB){
    lines.push(
      `B: ${item.approverB} / ${item.approvedAtB || ""} / ${item.commentB || ""}`
    );
  }

  if(lines.length===0){
    return "まだ承認はありません";
  }

  return lines.join("\n");

}

// ================================
// カード作成
// ================================

function makeCard_(item){

  const aDone = !!item.approverA;
  const bDone = !!item.approverB;

  const attach = makeAttachmentHtml_(
    item.attachmentUrls,
    item.attachmentPreviewUrls
  );

  const pdfBlock =
    item.pdfPreviewUrl
    ?
    `
    <div class="pdfWrap">

      <div class="attachTitle">
      起案書PDF
      </div>

      <div class="meta">
        <a href="${esc(item.pdfUrl)}" target="_blank">
        PDFを開く
        </a>
      </div>

      <iframe
        class="pdfFrame"
        src="${esc(item.pdfPreviewUrl)}">
      </iframe>

    </div>
    `
    :
    "";

  return `

<div class="cardItem">

  <div class="cardHead">

    <div>

      <span class="badge">
      ${esc(item.typeLabel)}
      </span>

      <span class="badge">
      整理番号: ${esc(item.seiriNo)}
      </span>

      <div class="kianId">
      起案番号: ${esc(item.kianId)}
      </div>

    </div>

    <div class="kianId">
    ${esc(item.createdAt)}
    </div>

  </div>

  <div class="title">
  ${esc(item.title)}
  </div>

  <div class="content">
  ${esc(item.content)}
  </div>

  ${pdfBlock}

  ${attach}

  <div class="attachItem">

    <div class="attachTitle">
    承認履歴
    </div>

    <pre class="draftList">
${esc(makeApprovalsText_(item))}
    </pre>

  </div>

  <div class="twoApprovers">

    <!-- A -->

    <div class="approverBox ${aDone ? "doneBox":""}">

      <strong>
      承認者A
      </strong>

      <label>氏名</label>

      <input
        id="nameA_${esc(item.kianId)}"
        type="text"
        ${aDone ? "disabled":""}
      >

      <label>コメント</label>

      <textarea
        id="commentA_${esc(item.kianId)}"
        rows="3"
        ${aDone ? "disabled":""}
      ></textarea>

      <button
        class="approveBtn ${aDone ? "doneBtn":""}"
        ${aDone ? "disabled":""}
        onclick="${
          aDone ? "" :
          `approveOne('${esc(item.kianId)}','A')`
        }"
      >
      ${aDone ? "A承認済":"Aとして承認"}
      </button>

    </div>


    <!-- B -->

    <div class="approverBox ${bDone ? "doneBox":""}">

      <strong>
      承認者B
      </strong>

      <label>氏名</label>

      <input
        id="nameB_${esc(item.kianId)}"
        type="text"
        ${bDone ? "disabled":""}
      >

      <label>コメント</label>

      <textarea
        id="commentB_${esc(item.kianId)}"
        rows="3"
        ${bDone ? "disabled":""}
      ></textarea>

      <button
        class="approveBtn ${bDone ? "doneBtn":""}"
        ${bDone ? "disabled":""}
        onclick="${
          bDone ? "" :
          `approveOne('${esc(item.kianId)}','B')`
        }"
      >
      ${bDone ? "B承認済":"Bとして承認"}
      </button>

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
      status:"pending"
    });

    if(!data.ok){
      setMsg("失敗: "+data.message);
      return;
    }

    const box=$("cards");

    if(!data.items || data.items.length===0){
      box.innerHTML="承認待ちはありません";
      setMsg("");
      return;
    }

    box.innerHTML = data.items
      .map(makeCard_)
      .join("");

    setMsg("");

  }catch(err){

    setMsg("エラー: "+err);

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
      setMsg("失敗: "+data.message);
      return;
    }

    setMsg("承認しました");

    loadList();

  }catch(err){

    setMsg("エラー: "+err);

  }

}

// ================================

window.addEventListener(
  "load",
  loadList
);
