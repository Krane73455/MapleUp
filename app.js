
const STORE_KEY = "mapleup-v1";

const sampleData = {
  characters: [
    {
      id: crypto.randomUUID(),
      name: "暗夜行者",
      job: "暗夜行者",
      level: 280,
      currentPower: 20800000,
      maxPower: 23800000,
      targetBoss: "困難史烏",
      bestTime: "34:51",
      notes: "優先檢查武器／副武器與 ARC",
      stats: { "主屬性": "42,300", "Boss 傷害": "387%", "無視防禦": "96.4%", "爆擊傷害": "86%", "ARC": "1,320", "AUT": "280" },
      equipment: [
        { slot:"武器", grade:"🟠 優先", note:"有明顯提升空間" },
        { slot:"副武器", grade:"🟠 優先", note:"潛能待改善" },
        { slot:"能源", grade:"🟡 尚可", note:"可後續處理" },
        { slot:"塔戒", grade:"🟢 完成", note:"已配置" }
      ],
      powerHistory: [
        {date:"08/20", value:18200000},
        {date:"09/01", value:19500000},
        {date:"09/10", value:20800000},
        {date:"09/17", value:23800000}
      ]
    },
    {
      id: crypto.randomUUID(),
      name: "重砲指揮官",
      job: "重砲指揮官",
      level: 275,
      currentPower: 19400000,
      maxPower: 19400000,
      targetBoss: "指定 Boss",
      bestTime: "14:00",
      notes: "已低於 30 分鐘，可停手",
      stats: { "主屬性": "-", "Boss 傷害": "-", "無視防禦": "-", "ARC": "-", "AUT": "-" },
      equipment: [],
      powerHistory: [{date:"09/13", value:19400000}]
    },
    {
      id: crypto.randomUUID(),
      name: "箭神",
      job: "箭神",
      level: 270,
      currentPower: 16500000,
      maxPower: 16500000,
      targetBoss: "指定 Boss",
      bestTime: "",
      notes: "尚未測試指定 Boss",
      stats: { "主屬性": "-", "Boss 傷害": "-", "無視防禦": "-", "ARC": "-", "AUT": "-" },
      equipment: [],
      powerHistory: [{date:"09/17", value:16500000}]
    }
  ],
  crystalWeeks: [
    { week:"2026/09/14–09/20", character:"暗夜行者", income:0, done:false },
    { week:"2026/09/14–09/20", character:"重砲指揮官", income:150000000, done:true },
    { week:"2026/09/14–09/20", character:"箭神", income:0, done:false }
  ],
  settings: { stopUnderMinutes: 30 }
};

const RECOVERY_KEY = STORE_KEY + "-recovery";
let storageProblem = "";
function loadData(){
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if(saved !== null) return MapleData.parseBackup(saved);
    const initial = MapleData.normalize(sampleData);
    localStorage.setItem(STORE_KEY, JSON.stringify(initial));
    return initial;
  } catch(error){
    storageProblem = "本機資料無法讀取，已暫停修改以保護原資料。請到設定匯出原始資料，或還原有效備份。";
    return {characters:[],crystalWeeks:[],settings:{stopUnderMinutes:30}};
  }
}
let data = loadData();
const esc = value => String(value ?? "").replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let currentView = "dashboard";
let currentCharacterId = null;
let characterTab = "overview";

const view = document.querySelector("#view");
const pageTitle = document.querySelector("#pageTitle");
const dialog = document.querySelector("#characterDialog");
const form = document.querySelector("#characterForm");

const fmtPower = n => {
  if(!n) return "—";
  if(n >= 100000000) return `${(n/100000000).toFixed(2)}億`;
  if(n >= 10000) return `${Math.round(n/10000).toLocaleString()}萬`;
  return n.toLocaleString();
};
const fmtMoney = n => n ? `${(n/100000000).toFixed(2)}億` : "0";
const timeToSeconds = MapleData.seconds;
function getStatus(c){
  const sec = timeToSeconds(c.bestTime);
  if(sec === null) return {label:"待測", cls:"info", score:2};
  if(sec < data.settings.stopUnderMinutes*60) return {label:"停手", cls:"good", score:0};
  return {label:"待強化", cls:"bad", score:5};
}
function priority(c){
  const st = getStatus(c);
  if(st.score === 0) return 0;
  const sec = timeToSeconds(c.bestTime);
  if(sec === null) return 40;
  const gap = Math.max(0, sec - data.settings.stopUnderMinutes*60);
  const equipGaps = c.equipment?.filter(x => x.grade.includes("🟠")).length || 0;
  return 100 + Math.min(gap/10,60) + equipGaps*8;
}
function commitData(next,{recovery=false,restore=false}={}){
  if(storageProblem && !restore) throw new Error(storageProblem);
  const prepared = MapleData.normalize(next);
  try {
    if(recovery){
      const previous = localStorage.getItem(STORE_KEY);
      if(previous !== null) localStorage.setItem(RECOVERY_KEY,previous);
    }
    localStorage.setItem(STORE_KEY,JSON.stringify(prepared));
  } catch { throw new Error('儲存失敗，可能是瀏覽器空間不足或禁止儲存。此次修改未套用，請先匯出備份。'); }
  data = prepared;
  storageProblem = '';
}
function notify(message){
  const el = document.querySelector('#notice');
  el.textContent = message;
  el.hidden = !message;
}
function localDate(){
  const d = new Date();
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
}
function setNav(){
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === currentView));
}
function render(){
  setNav();
  if(currentView === "dashboard") renderDashboard();
  if(currentView === "characters") renderCharacters();
  if(currentView === "crystals") renderCrystals();
  if(currentView === "settings") renderSettings();
  if(currentView === "character") renderCharacterDetail();
}
function renderDashboard(){
  pageTitle.textContent = "強化總覽";
  const chars = [...data.characters];
  const ranked = chars.filter(c => getStatus(c).score > 0).sort((a,b)=>priority(b)-priority(a));
  const stopped = chars.filter(c=>getStatus(c).score === 0);
  const untested = chars.filter(c=>getStatus(c).label === "待測");
  const weekIncome = data.crystalWeeks.reduce((s,x)=>s+x.income,0);

  view.innerHTML = `
    <div class="grid metrics">
      <div class="metric"><small>🔥 待強化</small><strong>${ranked.filter(c=>getStatus(c).label==="待強化").length}</strong></div>
      <div class="metric"><small>🟡 待測試</small><strong>${untested.length}</strong></div>
      <div class="metric"><small>✅ 已停手</small><strong>${stopped.length}</strong></div>
      <div class="metric"><small>💰 本週結晶</small><strong>${fmtMoney(weekIncome)}</strong></div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><h3>🔥 強化優先順位</h3><p>先排除已達 &lt; ${data.settings.stopUnderMinutes}:00 的角色，再依實戰時間與裝備缺口排序。</p></div>
      </div>
      ${ranked.length ? `
      <div class="priority-list">
        <div class="priority-row header"><span>順位</span><span>角色</span><span>Boss</span><span>最佳時間</span><span>狀態</span><span>主要缺口</span></div>
        ${ranked.map((c,i)=>`
          <div class="priority-row" data-character="${esc(c.id)}">
            <span class="rank">#${i+1}</span>
            <span class="name-cell"><strong>${esc(c.name)}</strong><small>${esc(c.job)} Lv.${c.level}</small></span>
            <span>${esc(c.targetBoss || "—")}</span>
            <span>${esc(c.bestTime || "未測")}</span>
            <span><span class="badge ${getStatus(c).cls}">${getStatus(c).label}</span></span>
            <span>${esc(c.notes || "—")}</span>
          </div>`).join("")}
      </div>` : `<div class="empty">目前沒有需要強化的角色 🎉</div>`}
    </div>

    <div class="panel">
      <div class="panel-head"><div><h3>📈 最近最高戰力</h3><p>首頁只顯示摘要；完整曲線在角色 → 戰力紀錄。</p></div></div>
      <div class="characters-grid grid">
        ${[...chars].sort((a,b)=>b.maxPower-a.maxPower).slice(0,3).map(c=>`
          <article class="character-card" data-character="${esc(c.id)}">
            <div class="character-top"><div><h3>${esc(c.name)}</h3><span class="muted">${esc(c.job)}</span></div><span class="badge ${getStatus(c).cls}">${getStatus(c).label}</span></div>
            <div class="stat-pair">
              <div class="mini-stat"><small>🏆 最高戰力</small><strong>${fmtPower(c.maxPower)}</strong></div>
              <div class="mini-stat"><small>⚔️ 目前戰力</small><strong>${fmtPower(c.currentPower)}</strong></div>
            </div>
          </article>`).join("")}
      </div>
    </div>`;
  bindCharacterClicks();
}
function renderCharacters(){
  pageTitle.textContent = "角色管理";
  view.innerHTML = `
    <div class="panel">
      <div class="panel-head"><div><h3>所有角色</h3><p>點擊角色進入總覽、能力面板、裝備分析與戰力紀錄。</p></div></div>
      <div class="characters-grid grid">
        ${data.characters.map(c=>`
        <article class="character-card" data-character="${esc(c.id)}">
          <div class="character-top">
            <div><h3>${esc(c.name)}</h3><span class="muted">${esc(c.job)} Lv.${c.level}</span></div>
            <span class="badge ${getStatus(c).cls}">${getStatus(c).label}</span>
          </div>
          <div class="stat-pair">
            <div class="mini-stat"><small>🏆 最高戰力</small><strong>${fmtPower(c.maxPower)}</strong></div>
            <div class="mini-stat"><small>⏱️ 最佳時間</small><strong>${esc(c.bestTime || "未測")}</strong></div>
          </div>
          <small class="muted">${esc(c.targetBoss || "尚未設定 Boss")}</small>
        </article>`).join("")}
      </div>
    </div>`;
  bindCharacterClicks();
}
function renderCharacterDetail(){
  const c = data.characters.find(x=>x.id===currentCharacterId);
  if(!c){ currentView="characters"; return render(); }
  pageTitle.textContent = c.name;
  const tabs = [
    ["overview","📊 總覽"],["stats","📋 能力面板"],["equipment","🛡️ 裝備分析"],["power","📈 戰力紀錄"]
  ];
  view.innerHTML = `
    <div class="character-actions"><button id="editCharacter" class="primary-btn">編輯角色／更新戰力</button><button id="deleteCharacter" class="danger-btn">刪除角色</button></div>
    <div class="tabs">${tabs.map(([k,l])=>`<button class="tab-btn ${characterTab===k?"active":""}" data-tab="${esc(k)}">${l}</button>`).join("")}</div>
    <div id="characterTab"></div>`;
  document.querySelectorAll(".tab-btn").forEach(b=>b.onclick=()=>{characterTab=b.dataset.tab;renderCharacterDetail()});
  document.querySelector('#editCharacter').onclick=()=>openCharacter(c);
  document.querySelector('#deleteCharacter').onclick=()=>{
    if(!confirm('刪除「'+c.name+'」及其戰力紀錄？既有結晶收入會保留。刪除前會保存一份本機復原備份。')) return;
    try {
      const next=structuredClone(data);
      next.characters=next.characters.filter(x=>x.id!==c.id);
      commitData(next,{recovery:true});
      currentCharacterId=null;currentView='characters';render();notify('角色已刪除；結晶收入紀錄已保留。');
    } catch(error){notify(error.message);}
  };
  renderCharacterTab(c);
}
function renderCharacterTab(c){
  const host = document.querySelector("#characterTab");
  if(characterTab==="overview"){
    host.innerHTML = `
    <div class="grid metrics">
      <div class="metric"><small>🏆 歷史最高</small><strong>${fmtPower(c.maxPower)}</strong></div>
      <div class="metric"><small>⚔️ 目前戰力</small><strong>${fmtPower(c.currentPower)}</strong></div>
      <div class="metric"><small>👹 指定 Boss</small><strong style="font-size:20px">${esc(c.targetBoss || "—")}</strong></div>
      <div class="metric"><small>⏱️ 最佳時間</small><strong>${esc(c.bestTime || "未測")}</strong></div>
    </div>
    <div class="detail-grid">
      <div class="panel"><div class="panel-head"><div><h3>📈 戰力趨勢</h3><p>保存每次抓取資料，最高戰力另外獨立保留。</p></div></div>${powerChart(c)}</div>
      <div class="panel"><div class="panel-head"><div><h3>🎯 目前判定</h3></div></div>
        <div class="callout"><strong>${getStatus(c).label === "停手" ? "✅ 已達停手條件" : getStatus(c).label === "待測" ? "🟡 先測指定 Boss" : "🔥 仍需強化"}</strong><p class="muted">${esc(c.notes || "")}</p></div>
      </div>
    </div>`;
  }
  if(characterTab==="stats"){
    host.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>📋 能力面板</h3><p>只顯示角色數值，不在這裡做裝備強化判斷。</p></div></div>
      <div class="stat-list">
        <div class="stat-item"><span>戰鬥力</span><strong>${c.currentPower.toLocaleString()}</strong></div>
        ${Object.entries(c.stats||{}).map(([k,v])=>`<div class="stat-item"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}
      </div></div>`;
  }
  if(characterTab==="equipment"){
    host.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>🛡️ 裝備分析</h3><p>這裡只處理裝備與強化優先順序。</p></div></div>
      ${c.equipment?.length ? `<div class="equipment-list">${c.equipment.map(e=>`<div class="equipment-item"><div><strong>${esc(e.slot)}</strong><div class="muted">${esc(e.note)}</div></div><span>${esc(e.grade)}</span></div>`).join("")}</div>` : `<div class="empty">尚未建立裝備分析資料。</div>`}
    </div>`;
  }
  if(characterTab==="power"){
    host.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>📈 戰力紀錄</h3><p>目前戰力與最高戰力分開保存，未來 NEXON API 同步會寫入這裡。</p></div></div>
      ${powerChart(c)}
      <table><thead><tr><th>日期</th><th>戰力</th><th>是否最高</th></tr></thead><tbody>
      ${(c.powerHistory||[]).slice().reverse().map(x=>`<tr><td>${esc(x.date)}</td><td>${x.value.toLocaleString()}</td><td>${x.value===c.maxPower?"🏆":""}</td></tr>`).join("")}
      </tbody></table>
    </div>`;
  }
}
function powerChart(c){
  const arr = c.powerHistory || [];
  if(!arr.length) return `<div class="empty">尚無戰力紀錄</div>`;
  const max = Math.max(...arr.map(x=>x.value),1);
  return `<div class="chart">${arr.map(x=>`<div class="bar" style="height:${Math.max(8,(x.value/max)*100)}%"><span>${fmtPower(x.value)}</span></div>`).join("")}</div>`;
}
function renderCrystals(){
  pageTitle.textContent = "結晶收入";
  const total = data.crystalWeeks.reduce((s,x)=>s+x.income,0);
  view.innerHTML = `<div class="grid metrics">
    <div class="metric"><small>💰 本週收入</small><strong>${fmtMoney(total)}</strong></div>
    <div class="metric"><small>✅ 已完成角色</small><strong>${data.crystalWeeks.filter(x=>x.done).length}</strong></div>
    <div class="metric"><small>⬜ 未完成角色</small><strong>${data.crystalWeeks.filter(x=>!x.done).length}</strong></div>
    <div class="metric"><small>👥 角色數</small><strong>${data.characters.length}</strong></div>
  </div>
  <div class="panel">
    <div class="panel-head"><div><h3>本週打王</h3><p>第一版先保留角色級別的結晶收入，後續可擴充成逐 Boss 勾選。</p></div></div>
    <table><thead><tr><th>角色</th><th>區間</th><th>完成</th><th>收入</th></tr></thead><tbody>
      ${data.crystalWeeks.map(x=>`<tr><td>${esc(x.character)}</td><td>${esc(x.week)}</td><td>${x.done?"✅":"⬜"}</td><td>${fmtMoney(x.income)}</td></tr>`).join("")}
    </tbody></table>
  </div>`;
}
function renderSettings(){
  pageTitle.textContent = "設定";
  view.innerHTML = `
  <div class="detail-grid">
    <div class="panel"><div class="panel-head"><div><h3>🎯 停手規則</h3><p>嚴格小於 30:00 才算達標。</p></div></div>
      <div class="stat-item"><span>通關時間門檻</span><strong>&lt; ${data.settings.stopUnderMinutes}:00</strong></div>
    </div>
    <div class="panel"><div class="panel-head"><div><h3>🔄 NEXON API</h3><p>第一版先預留接口，API Key 不會放在前端。</p></div></div>
      <div class="callout"><strong>尚未連線</strong><p class="muted">正式版建議由後端排程抓取，保存目前戰力、最高戰力與歷史快照。</p></div>
    </div>
  </div>
  <div class="panel"><div class="panel-head"><div><h3>🛟 本機資料</h3><p>資料儲存在目前瀏覽器，不會自動跨裝置同步。請定期匯出 JSON 備份。</p></div></div>
    <div class="backup-actions">
    <button id="exportBackup" class="primary-btn">匯出 JSON 備份</button>
    <button id="importBackup" class="ghost-btn">匯入／還原 JSON</button>
    <button id="exportRecovery" class="ghost-btn">下載上次操作前備份</button>
    <button id="resetDemo" class="danger-btn">重置為示範資料</button>
    </div>
    <input id="backupFile" type="file" accept=".json,application/json" hidden />
    <p class="muted">支援新版備份與舊版原始 JSON。匯入會先顯示預覽，再由你確認取代。</p>
  </div>`;
  document.querySelector('#exportBackup').onclick=()=>{
    try {
      const raw=storageProblem ? localStorage.getItem(STORE_KEY) : MapleData.backup(data);
      if(raw===null) throw new Error('目前沒有可匯出的原始資料。');
      download(raw,storageProblem?'MapleUp-original':'MapleUp-backup');notify('已建立備份下載。');
    } catch(error){notify(error.message);}
  };
  document.querySelector('#exportRecovery').onclick=()=>{
    try {
      const raw=localStorage.getItem(RECOVERY_KEY);
      if(raw===null) throw new Error('尚無操作前備份；匯入、刪除或重置時會自動保留上一份資料。');
      download(raw,'MapleUp-recovery');
    } catch(error){notify(error.message);}
  };
  document.querySelector('#importBackup').onclick=()=>document.querySelector('#backupFile').click();
  document.querySelector('#backupFile').onchange=async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try {
      if(file.size>10*1024*1024) throw new Error('備份超過 10 MB，請確認檔案。');
      pendingImport=MapleData.parseBackup(await file.text());
      document.querySelector('#importSummary').textContent='備份包含 '+pendingImport.characters.length+' 隻角色、'+pendingImport.characters.reduce((n,c)=>n+c.powerHistory.length,0)+' 筆戰力紀錄、'+pendingImport.crystalWeeks.length+' 筆結晶紀錄。目前有 '+data.characters.length+' 隻角色。';
      document.querySelector('#importError').hidden=true;
      document.querySelector('#importDialog').showModal();
    } catch(error){pendingImport=null;notify(error.message);}
  };
  document.querySelector('#resetDemo').onclick=()=>{
    if(!confirm('確定將目前全部資料替換為示範資料？操作前會保留一份本機復原備份。'))return;
    try {commitData(sampleData,{recovery:true});render();notify('已重置為示範資料。');}catch(error){notify(error.message);}
  };
}
function bindCharacterClicks(){
  document.querySelectorAll("[data-character]").forEach(el=>el.onclick=()=>{
    currentCharacterId=el.dataset.character;
    currentView="character";
    characterTab="overview";
    render();
  });
}
document.querySelectorAll(".nav-btn").forEach(btn=>btn.onclick=()=>{
  currentView=btn.dataset.view;
  currentCharacterId=null;
  render();
});
let editingId=null;
let pendingImport=null;
function download(raw,prefix){
  const url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;
  a.download=prefix+'-'+localDate()+'-'+new Date().toTimeString().slice(0,8).replaceAll(':','')+'.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function openCharacter(c=null){
  if(storageProblem){notify(storageProblem);return;}
  editingId=c?.id || null;form.reset();
  document.querySelector('#formError').hidden=true;
  document.querySelector('#characterDialogTitle').textContent=c?'編輯角色／更新戰力':'新增角色';
  document.querySelector('#saveCharacterBtn').textContent=c?'儲存變更':'新增';
  for(const name of ['name','job','level','currentPower','targetBoss','bestTime','notes']){
    if(c) form.elements.namedItem(name).value=c[name];
  }
  dialog.showModal();
}
document.querySelectorAll('[data-close-character]').forEach(btn=>btn.onclick=()=>dialog.close());
document.querySelector('#addCharacterBtn').onclick=()=>openCharacter();
form.addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const fd=new FormData(form);
    const fields={name:String(fd.get('name')).trim(),job:String(fd.get('job')).trim(),level:Number(fd.get('level')),currentPower:Number(fd.get('currentPower')||0),targetBoss:String(fd.get('targetBoss')).trim(),bestTime:String(fd.get('bestTime')).trim(),notes:String(fd.get('notes')).trim()};
    if(!fields.name || !fields.job) throw new Error('請填寫角色名稱與職業。');
    if(fields.bestTime && timeToSeconds(fields.bestTime)===null) throw new Error('請填寫有效時間，例如 28:42；秒數為 00–59，總時間須大於零。');
    let next;
    if(editingId){
      const original=data.characters.find(c=>c.id===editingId);
      if(original && original.targetBoss!==fields.targetBoss && fields.bestTime && !confirm('指定 Boss 已變更。確認 '+fields.bestTime+' 是新 Boss 的通關時間？')) return;
      next=MapleData.edit(data,editingId,fields,localDate());
    } else {
      next=structuredClone(data);
      next.characters.push({id:crypto.randomUUID(),...fields,maxPower:fields.currentPower,stats:{'主屬性':'-','Boss 傷害':'-','無視防禦':'-','ARC':'-','AUT':'-'},equipment:[],powerHistory:fields.currentPower?[{date:localDate(),value:fields.currentPower}]:[]});
    }
    commitData(next);
    dialog.close();
    if(editingId){currentCharacterId=editingId;currentView='character';}else{currentView='characters';}
    render();notify(editingId?'角色已更新；戰力變更已保存到歷史。':'角色已新增。');
  } catch(error){const el=document.querySelector('#formError');el.textContent=error.message;el.hidden=false;}
});
document.querySelector('#cancelImport').onclick=()=>document.querySelector('#importDialog').close();
document.querySelector('#importDialog').addEventListener('close',()=>{pendingImport=null;});
document.querySelector('#confirmImport').onclick=()=>{
  if(!pendingImport)return;
  try {
    commitData(pendingImport,{recovery:true,restore:true});
    document.querySelector('#importDialog').close();currentCharacterId=null;currentView='characters';render();notify('備份已還原。原資料可從設定下載「上次操作前備份」。');
  } catch(error){const el=document.querySelector('#importError');el.textContent=error.message;el.hidden=false;}
};
render();
if(storageProblem)notify(storageProblem);
