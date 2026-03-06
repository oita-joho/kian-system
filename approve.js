// ================================
// approve.js
// ================================
const GAS_URL = "YOUR_GAS_WEBAPP_URL";

function $(id){ return document.getElementById(id); }
function esc(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}
function setMsg(msg){ $("msg").textContent = msg || ""; }

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
    throw new Error("JSONではない応答: " + text);
  }
}

function makeAttachmentHtml_(urls, previews){
  if(!Array.isArray(urls) || urls.length === 0) return "";

  let html = "";
  urls.forEach((url, i) => {
    const preview = Array.isArray(previews) && previews[i] ? previews[i] : "";
    html += `
      <div class="attachItem">
        <div class="attachTitle">添付PDF ${i + 1}</div>
        <div class="meta">
          <span><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">PDFを別窓で開く</a></span>
        </div>
        ${
          preview
            ? `<iframe class="pdfFrame" src="${esc(preview)}" loading="lazy" referrerpolicy="no-referrer"></iframe>`
            : `<div class="meta"><span>プレビューなし</span></div>`
        }
      </div>
    `;
  });
  return html;
}

function makeApprovalsText_(item){
  const lines = [];
  if(item.approverA){
    lines.push(`A: ${item.approverA} / ${item.approvedAtA || ""} / ${item.commentA || ""}`);
  }
  if(item.approverB){
    lines.push(`B: ${item.approverB} / ${item.approvedAtB || ""} / ${item.commentB || ""}`);
  }
  return lines.length ? lines.join("\n") : "まだ承認はありません。";
}

function makeCard_(item){
  const attach = makeAttachmentHtml_(item.attachmentUrls, item.attachmentPreviewUrls);

  const pdfBlock = item.pdfPreviewUrl
    ? `
      <div class="pdfWrap">
        <div class="attachTitle">起案書PDF</div>
        <div class="meta">
          <span><a href="${esc(item.pdfUrl || "")}" target="_blank" rel="noopener noreferrer">PDFを別窓で開く</a></span>
        </div>
        <iframe class="pdfFrame" src="${esc(item.pdfPreviewUrl)}" loading="lazy" referrerpolicy="no-referrer"></iframe>
      </div>
    `
    : `<div class="meta"><span>起案書PDFなし</span></div>`;

  return `
    <div class="cardItem">
      <div class="cardHead">
        <div>
          <span class="badge">${esc(item.typeLabel || "")}</span>
          <span class="badge">整理番号: ${esc(item.seiriNo || "")}</span>
          <div class="kianId">起案番号: ${esc(item.kianId || "")}</div>
        </div>
        <div class="kianId">${esc(item.createdAt || "")}</div>
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

      ${pdfBlock}
      ${attach}

      <div class="attachItem">
        <div class="attachTitle">承認状況</div>
        <pre class="draftList">${esc(makeApprovalsText_(item))}</pre>
      </div>

      <div class="twoApprovers">
        <div class="approverBox">
          <strong>承認者A</strong>
          <label>氏名</label>
          <input type="text" id="nameA_${esc(item.kianId)}" placeholder="承認者Aの名前">
          <label>コメント</label>
          <textarea id="commentA_${esc(item.kianId)}" rows="3"></textarea>
          <button class="approveBtn" onclick="approveOne('${esc(item.kianId)}','A')">Aとして承認</button>
        </div>

        <div class="approverBox">
          <strong>承認者B</strong>
          <label>氏名</label>
          <input type="text" id="nameB_${esc(item.kianId)}" placeholder="承認者Bの名前">
          <label>コメント</label>
          <textarea id="commentB_${esc(item.kianId)}" rows="3"></textarea>
          <button class="approveBtn" onclick="approveOne('${esc(item.kianId)}','B')">Bとして承認</button>
        </div>
      </div>
    </div>
  `;
}

async function loadList(){
  setMsg("一覧を読み込み中…");
  try{
    const data = await api_({
      action: "list",
      status: "pending",
      limit: 50
    });

    if(!data.ok){
      setMsg("失敗: " + (data.message || "unknown"));
      return;
    }

    const box = $("cards");
    if(!data.items || data.items.length === 0){
      box.innerHTML = `<div class="cardItem">承認待ちの文書はありません。</div>`;
      setMsg("");
      return;
    }

    box.innerHTML = data.items.map(makeCard_).join("");
    setMsg("");
  }catch(err){
    setMsg("読み込みエラー: " + err);
  }
}

async function approveOne(kianId, side){
  const approverName = ($(`name${side}_${kianId}`)?.value || "").trim();
  const comment = ($(`comment${side}_${kianId}`)?.value || "").trim();

  if(!approverName){
    alert(`承認者${side}の名前を入力してください。`);
    return;
  }

  setMsg(`承認${side}を送信中…`);

  try{
    const data = await api_({
      action: "approve",
      kianId,
      side,
      approverName,
      comment
    });

    if(!data.ok){
      setMsg("失敗: " + (data.message || "unknown"));
      return;
    }

    setMsg(`承認しました。状態: ${data.status}`);
    await loadList();
  }catch(err){
    setMsg("承認エラー: " + err);
  }
}

window.addEventListener("load", loadList);
