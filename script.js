function checkForm(){

  const type = document.getElementById("type").value;
  const seiriNo = document.getElementById("seiriNo").value.trim();

  if(type===""){
    alert("区分を選択してください");
    return false;
  }

  if(seiriNo===""){
    alert("整理番号を入力してください");
    return false;
  }

  return true;
}
