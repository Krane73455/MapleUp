
const STORE_KEY = "mapleup-v1";
const NEXON_KEY = "mapleup-nexon-api-key";

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
let selectedCrystalWeek = weekStartISO(new Date());
let selectedCrystalMonth = localDate().slice(0,7);
let selectedBossCharacterId = null;
let characterFilter = 'all';
let characterSearch = '';

function savedApiKey(){
  try { return localStorage.getItem(NEXON_KEY) || ""; } catch { return ""; }
}
function updateSyncCard(){
  const small=document.querySelector('.sync-card small');
  const dot=document.querySelector('.status-dot');
  if(!small || !dot) return;
  const ready=Boolean(savedApiKey());
  small.textContent=ready?'API Key 已設定':'尚未設定 Key';
  dot.classList.toggle('connected',ready);
}

const view = document.querySelector("#view");
const pageTitle = document.querySelector("#pageTitle");
const dialog = document.querySelector("#characterDialog");
const form = document.querySelector("#characterForm");
const crystalDialog = document.querySelector('#crystalDialog');
const crystalForm = document.querySelector('#crystalForm');

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
function isoDate(date){
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
function weekStartISO(date){
  const d = new Date(date.getFullYear(),date.getMonth(),date.getDate());
  d.setDate(d.getDate()-((d.getDay()+6)%7));
  return isoDate(d);
}
function weekLabel(startISO){
  const start = new Date(`${startISO}T00:00:00`);
  if(Number.isNaN(start.getTime())) return startISO;
  const end = new Date(start);end.setDate(start.getDate()+6);
  const first = `${start.getFullYear()}/${String(start.getMonth()+1).padStart(2,'0')}/${String(start.getDate()).padStart(2,'0')}`;
  const last = start.getFullYear()===end.getFullYear()
    ? `${String(end.getMonth()+1).padStart(2,'0')}/${String(end.getDate()).padStart(2,'0')}`
    : `${end.getFullYear()}/${String(end.getMonth()+1).padStart(2,'0')}/${String(end.getDate()).padStart(2,'0')}`;
  return `${first}–${last}`;
}
const crystalCycle = row => row.cycle === 'monthly' ? 'monthly' : 'weekly';
const crystalWeekKey = row => crystalCycle(row)==='weekly' ? (row.weekStart || `legacy:${row.week}`) : '';
const selectedCrystalRows = () => data.crystalWeeks.filter(row=>crystalCycle(row)==='weekly' && crystalWeekKey(row)===selectedCrystalWeek);
const activeCharacters = () => data.characters.filter(c=>!c.archived);
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
  const chars = activeCharacters();
  const ranked = chars.filter(c => getStatus(c).score > 0).sort((a,b)=>priority(b)-priority(a));
  const stopped = chars.filter(c=>getStatus(c).score === 0);
  const untested = chars.filter(c=>getStatus(c).label === "待測");
  const currentWeek = weekStartISO(new Date());
  const weekIncome = data.crystalWeeks.filter(x=>crystalCycle(x)==='weekly' && crystalWeekKey(x)===currentWeek && x.done).reduce((s,x)=>s+x.income,0);

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
  const search=characterSearch.trim().toLowerCase();
  const counts={all:data.characters.filter(c=>!c.archived).length,stopped:0,invest:0,untested:0,archived:data.characters.filter(c=>c.archived).length};
  for(const c of data.characters.filter(c=>!c.archived)){
    const label=getStatus(c).label;
    if(label==='停手')counts.stopped++;else if(label==='待強化')counts.invest++;else counts.untested++;
  }
  const rows=data.characters.filter(c=>{
    if(characterFilter==='archived'){if(!c.archived)return false;}
    else{
      if(c.archived)return false;
      const label=getStatus(c).label;
      if(characterFilter==='stopped'&&label!=='停手')return false;
      if(characterFilter==='invest'&&label!=='待強化')return false;
      if(characterFilter==='untested'&&label!=='待測')return false;
    }
    return !search || [c.name,c.job,c.targetBoss].some(value=>String(value||'').toLowerCase().includes(search));
  });
  const filters=[['all','全部'],['stopped','停手'],['invest','待投資'],['untested','待測'],['archived','封存']];
  view.innerHTML = `
    <div class="character-toolbar">
      <div class="filter-tabs">${filters.map(([key,label])=>`<button class="tab-btn ${characterFilter===key?'active':''}" data-character-filter="${key}">${label} <small>${counts[key]}</small></button>`).join('')}</div>
      <input id="characterSearch" type="search" value="${esc(characterSearch)}" placeholder="搜尋角色、職業或 Boss" aria-label="搜尋角色、職業或 Boss" />
    </div>
    <div class="panel character-table-panel">
      <div class="panel-head"><div><h3>分身名單 <span class="muted">${rows.length} 隻</span></h3><p>只有填入指定 Boss 且時間低於 30:00 才會判定停手。</p></div></div>
      ${rows.length?`<div class="table-wrap"><table class="character-table"><thead><tr><th>角色／職業</th><th>指定 Boss</th><th>通關時間</th><th>目前戰力</th><th>判定</th><th>最近同步</th><th>操作</th></tr></thead><tbody>
        ${rows.map(c=>`<tr class="${c.archived?'archived':''}">
          <td data-label="角色／職業"><div class="identity">${c.nexon?.characterImage?`<img class="table-avatar" src="${esc(c.nexon.characterImage)}" alt="" />`:`<span class="avatar-letter">${esc(c.name.slice(0,1))}</span>`}<div><strong>${esc(c.name)}</strong><small>${esc(c.job)} · Lv.${c.level}</small></div></div></td>
          <td data-label="指定 Boss">${esc(c.targetBoss||'—')}</td><td data-label="通關時間">${esc(c.bestTime||'—')}</td><td data-label="目前戰力">${fmtPower(c.currentPower)}</td>
          <td data-label="判定"><span class="badge ${c.archived?'warn':getStatus(c).cls}">${c.archived?'封存':getStatus(c).label}</span></td><td data-label="最近同步">${esc(c.nexon?.syncedAt?formatSyncTime(c.nexon.syncedAt):'—')}</td>
          <td data-label="操作"><div class="row-actions"><button class="ghost-btn character-open" data-id="${esc(c.id)}">查看</button><button class="ghost-btn character-edit" data-id="${esc(c.id)}">編輯</button><button class="ghost-btn character-archive" data-id="${esc(c.id)}">${c.archived?'啟用':'封存'}</button></div></td>
        </tr>`).join('')}
      </tbody></table></div>`:`<div class="empty">沒有符合條件的角色。</div>`}
    </div>`;
  document.querySelectorAll('[data-character-filter]').forEach(button=>button.onclick=()=>{characterFilter=button.dataset.characterFilter;renderCharacters();});
  const searchInput=document.querySelector('#characterSearch');
  searchInput.oninput=()=>{characterSearch=searchInput.value;renderCharacters();const next=document.querySelector('#characterSearch');next.focus();next.setSelectionRange(next.value.length,next.value.length);};
  document.querySelectorAll('.character-open').forEach(button=>button.onclick=()=>{currentCharacterId=button.dataset.id;currentView='character';characterTab='overview';render();});
  document.querySelectorAll('.character-edit').forEach(button=>button.onclick=()=>openCharacter(data.characters.find(c=>c.id===button.dataset.id)));
  document.querySelectorAll('.character-archive').forEach(button=>button.onclick=()=>{
    const next=structuredClone(data),c=next.characters.find(c=>c.id===button.dataset.id);if(!c)return;
    c.archived=!c.archived;commitData(next);renderCharacters();notify(c.archived?'角色已封存；歷史與結晶紀錄均保留。':'角色已重新啟用。');
  });
}
function renderCharacterDetail(){
  const c = data.characters.find(x=>x.id===currentCharacterId);
  if(!c){ currentView="characters"; return render(); }
  pageTitle.textContent = c.name;
  const tabs = [
    ["overview","📊 總覽"],["stats","📋 能力面板"],["equipment","🛡️ 裝備分析"],["power","📈 戰力紀錄"]
  ];
  view.innerHTML = `
    <div class="character-actions"><button id="syncCharacter" class="primary-btn">🔄 NEXON 同步</button><button id="editCharacter" class="ghost-btn">編輯角色／更新戰力</button><button id="archiveCharacter" class="ghost-btn">${c.archived?'重新啟用':'封存角色'}</button><button id="deleteCharacter" class="danger-btn">刪除角色</button></div>
    <div class="tabs">${tabs.map(([k,l])=>`<button class="tab-btn ${characterTab===k?"active":""}" data-tab="${esc(k)}">${l}</button>`).join("")}</div>
    <div id="characterTab"></div>`;
  document.querySelectorAll(".tab-btn").forEach(b=>b.onclick=()=>{characterTab=b.dataset.tab;renderCharacterDetail()});
  document.querySelector('#editCharacter').onclick=()=>openCharacter(c);
  document.querySelector('#syncCharacter').onclick=event=>syncOneCharacter(c.id,event.currentTarget);
  document.querySelector('#archiveCharacter').onclick=()=>{const next=structuredClone(data),row=next.characters.find(row=>row.id===c.id);row.archived=!row.archived;commitData(next);renderCharacterDetail();notify(row.archived?'角色已封存；歷史與結晶紀錄均保留。':'角色已重新啟用。');};
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
    ${c.nexon?.characterImage ? `<div class="nexon-character"><img src="${esc(c.nexon.characterImage)}" alt="${esc(c.name)} 角色圖片" /><div><strong>${esc(c.name)} · ${esc(c.job)} Lv.${c.level}</strong><small>最近同步：${esc(formatSyncTime(c.nexon.syncedAt))}${c.nexon.worldName?` · ${esc(c.nexon.worldName)}`:''}</small></div></div>`:''}
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
    const apiStats=c.nexon?.stats || [];
    host.innerHTML = `${apiStats.length?`<div class="panel"><div class="panel-head"><div><h3>🔄 NEXON 能力值</h3><p>${esc(formatSyncTime(c.nexon.syncedAt))} 同步；資料來自 NEXON Open API。</p></div></div><div class="stat-list">${apiStats.map(row=>`<div class="stat-item"><span>${esc(row.name)}</span><strong>${esc(row.value)}</strong></div>`).join('')}</div></div>`:''}<div class="panel"><div class="panel-head"><div><h3>📋 手動能力面板</h3><p>原本的手動資料會保留，不會被 API 覆蓋。</p></div></div>
      <div class="stat-list">
        <div class="stat-item"><span>戰鬥力</span><strong>${c.currentPower.toLocaleString()}</strong></div>
        ${Object.entries(c.stats||{}).map(([k,v])=>`<div class="stat-item"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join("")}
      </div></div>`;
  }
  if(characterTab==="equipment"){
    const apiEquipment=c.nexon?.equipment || [];
    host.innerHTML = `${apiEquipment.length?`<div class="panel"><div class="panel-head"><div><h3>🔄 NEXON 目前裝備</h3><p>API 同步結果只供檢視，不會改寫下方的手動分析。</p></div></div><div class="equipment-list">${apiEquipment.map(item=>`<div class="equipment-item"><div><strong>${esc(item.slot || '裝備')}</strong><div class="muted">${esc(item.name || '—')}</div></div><span>${esc(equipmentLabel(item))}</span></div>`).join('')}</div></div>`:''}<div class="panel"><div class="panel-head"><div><h3>🛡️ 手動裝備分析</h3><p>這裡處理你自己的強化優先順序。</p></div></div>
      ${c.equipment?.length ? `<div class="equipment-list">${c.equipment.map(e=>`<div class="equipment-item"><div><strong>${esc(e.slot)}</strong><div class="muted">${esc(e.note)}</div></div><span>${esc(e.grade)}</span></div>`).join("")}</div>` : `<div class="empty">尚未建立裝備分析資料。</div>`}
    </div>`;
  }
  if(characterTab==="power"){
    host.innerHTML = `<div class="panel"><div class="panel-head"><div><h3>📈 戰力紀錄</h3><p>目前戰力與最高戰力分開保存；NEXON 同步若有變動會新增紀錄。</p></div></div>
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
  const characters=activeCharacters();
  if(!characters.some(c=>c.id===selectedBossCharacterId)) selectedBossCharacterId=characters[0]?.id||null;
  const weekRows=rowsForCrystalPeriod('weekly'),monthRows=rowsForCrystalPeriod('monthly');
  const selectedCharacter=characters.find(c=>c.id===selectedBossCharacterId);
  const selectedWeekRows=weekRows.filter(row=>row.characterId===selectedBossCharacterId);
  const weeklyTotal=weekRows.reduce((sum,row)=>sum+row.income,0),monthlyTotal=weeklyTotal*4+monthRows.reduce((sum,row)=>sum+row.income,0);
  const weekDone=weekRows.filter(row=>row.done).reduce((sum,row)=>sum+row.income,0);
  const groupList=cycle=>[...new Set(BossCatalog.BOSSES.filter(b=>b.cycle===cycle).map(b=>b.group))];
  const bossRow=(group,cycle)=>{
    const variants=BossCatalog.BOSSES.filter(b=>b.group===group),record=bossRecordFor(group,cycle),shown=BossCatalog.getBoss(record?.bossId)||BossCatalog.matchBoss(record?.boss)||variants[0];
    const locked=Boolean(record&&(record.done||record.pricing!=='catalog'));
    const capped=!record&&cycle==='weekly'&&(selectedWeekRows.length>=12||weekRows.length>=90);
    return `<div class="boss-ledger-row ${record?'selected':''}"><div class="boss-ledger-name"><strong>${esc(shown.name)}</strong>${record?.pricing==='manual'?'<small>手填金額</small>':''}</div><div class="difficulty-buttons">${variants.map(boss=>`<button class="difficulty-btn ${record?.bossId===boss.id?'picked':''}" data-boss-pick="${boss.id}" ${locked||capped||!selectedCharacter?'disabled':''}>${esc(boss.difficulty)}</button>`).join('')}</div><div>${record?.pricing==='catalog'?`<select class="party-select" data-party-record="${esc(record.id)}" ${record.done?'disabled':''}>${Array.from({length:6},(_,i)=>`<option value="${i+1}" ${(record.partySize||1)===i+1?'selected':''}>${i===0?'單打':`${i+1} 人`}</option>`).join('')}</select>`:'<span class="muted">—</span>'}</div><div class="boss-price">${record?record.income.toLocaleString('zh-TW'):'—'}</div><div class="boss-complete">${record?`<input class="crystal-done" data-crystal-id="${esc(record.id)}" type="checkbox" ${record.done?'checked':''} aria-label="${esc(record.boss)} 已通關" />`:'—'}</div></div>`;
  };
  const detailRows=[...selectedWeekRows,...monthRows.filter(row=>row.characterId===selectedBossCharacterId)];
  view.innerHTML=`<div class="crystal-summary">
    <div><small>每週預估收入</small><strong>${fmtMoney(weeklyTotal)}</strong></div><div><small>每月預估收入</small><strong>${fmtMoney(monthlyTotal)}</strong><span>4 週收入＋月王</span></div><div><small>本週已完成</small><strong>${fmtMoney(weekDone)}</strong></div><div class="quota"><strong>${weekRows.length}<small> / 90</small></strong><span>已選週結晶</span></div>
  </div>
  <div class="crystal-periods"><label>週王週期<input id="crystalWeekPicker" type="date" value="${esc(selectedCrystalWeek)}" /></label><label>月王月份<input id="crystalMonthPicker" type="month" value="${esc(selectedCrystalMonth)}" /></label><button id="addCrystal" class="ghost-btn" ${characters.length?'':'disabled'}>＋ 手動紀錄</button></div>
  <div class="boss-workspace">
    <aside class="boss-roster"><div class="boss-roster-head"><h3>角色列表</h3><button id="bossAddCharacter" class="icon-btn">＋</button></div>${characters.map(c=>{const own=weekRows.filter(row=>row.characterId===c.id);return `<button class="roster-character ${c.id===selectedBossCharacterId?'active':''}" data-boss-character="${esc(c.id)}"><span>${esc(c.name)}</span><strong>${fmtMoney(own.reduce((sum,row)=>sum+row.income,0))}</strong><small>${own.length?`${own.length} 隻週王`:'尚未選擇週王'}</small></button>`}).join('')||'<div class="empty">請先新增角色。</div>'}</aside>
    <section class="panel boss-board"><div class="panel-head"><div><h3>${esc(selectedCharacter?.name||'Boss 清單')}</h3><p>點難度直接計算，再點一次取消。</p></div><span class="badge info">週王 ${selectedWeekRows.length} / 12</span></div>
      <div class="boss-ledger-row boss-ledger-head"><span>Boss</span><span>難度</span><span>人數</span><span>楓幣</span><span>通關</span></div>
      ${groupList('weekly').reverse().map(group=>bossRow(group,'weekly')).join('')}
      <div class="monthly-divider"><strong>月王</strong><span>${esc(selectedCrystalMonth)}</span></div>${groupList('monthly').map(group=>bossRow(group,'monthly')).join('')}
      <details class="crystal-details"><summary>日期與紀錄明細</summary>${detailRows.length?`<div class="table-wrap"><table><thead><tr><th>完成</th><th>Boss</th><th>週期</th><th>收入</th><th>備註</th><th>操作</th></tr></thead><tbody>${detailRows.map(row=>`<tr><td>${row.done?'✅':'⬜'}</td><td>${esc(row.boss)}</td><td>${esc(row.cycle==='monthly'?row.weekStart.slice(0,7):row.week)}</td><td>${row.income.toLocaleString('zh-TW')}</td><td>${esc(row.notes||'—')}</td><td><div class="row-actions"><button class="ghost-btn crystal-edit" data-crystal-id="${esc(row.id)}">編輯</button><button class="danger-btn crystal-delete" data-crystal-id="${esc(row.id)}">刪除</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">這個角色尚未選擇 Boss。</div>'}</details>
      <details class="crystal-details"><summary>計算說明</summary><p class="muted">價格為網站規則粗估（僅供參考）。個人金額＝參考價格÷隊伍人數，小數捨去。每角色最多新增 12 隻週王，所有角色合計最多 90 顆週結晶；舊紀錄及手動金額不會被自動改價。</p></details>
    </section>
  </div>`;
  document.querySelector('#crystalWeekPicker').onchange=event=>{const d=new Date(`${event.target.value}T00:00:00`);if(!Number.isNaN(d.getTime()))selectedCrystalWeek=weekStartISO(d);renderCrystals();};
  document.querySelector('#crystalMonthPicker').onchange=event=>{if(/^\d{4}-\d{2}$/.test(event.target.value))selectedCrystalMonth=event.target.value;renderCrystals();};
  document.querySelector('#addCrystal').onclick=()=>openCrystal();document.querySelector('#bossAddCharacter').onclick=()=>openCharacter();
  document.querySelectorAll('[data-boss-character]').forEach(button=>button.onclick=()=>{selectedBossCharacterId=button.dataset.bossCharacter;renderCrystals();});
  document.querySelectorAll('[data-boss-pick]').forEach(button=>button.onclick=()=>toggleCatalogBoss(button.dataset.bossPick));
  document.querySelectorAll('[data-party-record]').forEach(select=>select.onchange=()=>updateCatalogParty(select.dataset.partyRecord,Number(select.value)));
  document.querySelectorAll('.crystal-done').forEach(input=>input.onchange=()=>updateCrystalDone(input.dataset.crystalId,input.checked));
  document.querySelectorAll('.crystal-edit').forEach(button=>button.onclick=()=>openCrystal(data.crystalWeeks.find(row=>row.id===button.dataset.crystalId)));
  document.querySelectorAll('.crystal-delete').forEach(button=>button.onclick=()=>deleteCrystalRecord(button.dataset.crystalId));
}

function rowsForCrystalPeriod(cycle){
  return data.crystalWeeks.filter(row=>crystalCycle(row)===cycle&&(cycle==='weekly'?crystalWeekKey(row)===selectedCrystalWeek:row.weekStart?.slice(0,7)===selectedCrystalMonth));
}
function bossRecordFor(group,cycle){
  return rowsForCrystalPeriod(cycle).find(row=>row.characterId===selectedBossCharacterId&&BossCatalog.groupForRecord(row)===group);
}
function toggleCatalogBoss(bossId){
  try{
    const boss=BossCatalog.getBoss(bossId),record=bossRecordFor(boss.group,boss.cycle),periodRows=rowsForCrystalPeriod(boss.cycle),character=data.characters.find(c=>c.id===selectedBossCharacterId);
    if(!boss||!character)throw new Error('請先選擇角色。');
    if(record&&(record.done||record.pricing!=='catalog'))throw new Error('已通關或手填紀錄請到下方明細編輯。');
    const next=structuredClone(data);
    if(record?.bossId===boss.id){next.crystalWeeks=next.crystalWeeks.filter(row=>row.id!==record.id);commitData(next);renderCrystals();notify('已取消這個 Boss。');return;}
    if(!record&&boss.cycle==='weekly'&&(periodRows.filter(row=>row.characterId===character.id).length>=12||periodRows.length>=90))throw new Error('已達週王上限：每角色 12、全部角色 90。');
    const periodStart=boss.cycle==='weekly'?selectedCrystalWeek:`${selectedCrystalMonth}-01`;
    const value={...(record||{}),id:record?.id||crypto.randomUUID(),characterId:character.id,character:character.name,weekStart:periodStart,week:boss.cycle==='weekly'?weekLabel(periodStart):`${selectedCrystalMonth} 月王`,done:false,notes:record?.notes||'',...BossCatalog.priceSnapshot(boss,record?.partySize||1)};
    if(record)next.crystalWeeks[next.crystalWeeks.findIndex(row=>row.id===record.id)]=value;else next.crystalWeeks.push(value);
    commitData(next);renderCrystals();notify(`${value.boss} 已加入，個人結晶已自動計算。`);
  }catch(error){notify(error.message);}
}
function updateCatalogParty(recordId,partySize){
  try{const next=structuredClone(data),row=next.crystalWeeks.find(row=>row.id===recordId),boss=BossCatalog.getBoss(row?.bossId);if(!row||!boss)throw new Error('找不到這筆自動計價紀錄。');Object.assign(row,BossCatalog.priceSnapshot(boss,partySize));commitData(next);renderCrystals();notify('隊伍人數與個人結晶已更新。');}catch(error){notify(error.message);}
}
function updateCrystalDone(recordId,done){
  try{const next=structuredClone(data),row=next.crystalWeeks.find(row=>row.id===recordId);if(!row)throw new Error('找不到這筆結晶紀錄。');row.done=done;commitData(next);renderCrystals();notify(done?'已標記通關。':'已取消通關。');}catch(error){notify(error.message);}
}
function deleteCrystalRecord(recordId){
  const row=data.crystalWeeks.find(row=>row.id===recordId);if(!row||!confirm(`刪除「${row.character}－${row.boss}」的結晶紀錄？刪除前會保存復原備份。`))return;
  try{const next=structuredClone(data);next.crystalWeeks=next.crystalWeeks.filter(item=>item.id!==recordId);commitData(next,{recovery:true});renderCrystals();notify('結晶紀錄已刪除。');}catch(error){notify(error.message);}
}
function renderSettings(){
  pageTitle.textContent = "設定";
  view.innerHTML = `
  <div class="detail-grid">
    <div class="panel"><div class="panel-head"><div><h3>🎯 停手規則</h3><p>嚴格小於 30:00 才算達標。</p></div></div>
      <div class="stat-item"><span>通關時間門檻</span><strong>&lt; ${data.settings.stopUnderMinutes}:00</strong></div>
    </div>
    <div class="panel"><div class="panel-head"><div><h3>🔄 NEXON API</h3><p>輸入一次後即可同步角色資料。</p></div></div>
      <label class="api-key-label">API Key<input id="nexonApiKey" type="password" autocomplete="off" placeholder="貼上 NEXON Open API Key" /></label>
      <div class="api-actions"><button id="saveApiKey" class="primary-btn">儲存 Key</button><button id="clearApiKey" class="ghost-btn">清除 Key</button><button id="syncAllCharacters" class="ghost-btn" ${activeCharacters().length?'':'disabled'}>同步全部角色</button></div>
      <div id="apiStatus" class="callout"><strong>${savedApiKey()?'已設定，可以同步':'尚未設定'}</strong><p class="muted">Key 只保存在這個瀏覽器，不會寫進 GitHub，也不會包含在 JSON 備份。</p></div>
      <p class="api-credit">Data based on NEXON Open API · <a href="https://openapi.nexon.com/" target="_blank" rel="noopener">申請／查看 API Key</a></p>
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
  const keyInput=document.querySelector('#nexonApiKey');
  keyInput.value=savedApiKey();
  document.querySelector('#saveApiKey').onclick=()=>{
    const key=keyInput.value.trim();
    if(!key){notify('請先貼上 NEXON API Key。');return;}
    try { localStorage.setItem(NEXON_KEY,key);updateSyncCard();document.querySelector('#apiStatus strong').textContent='已設定，可以同步';notify('API Key 已保存在這個瀏覽器。'); }
    catch { notify('瀏覽器無法儲存 API Key。'); }
  };
  document.querySelector('#clearApiKey').onclick=()=>{
    try { localStorage.removeItem(NEXON_KEY);keyInput.value='';updateSyncCard();document.querySelector('#apiStatus strong').textContent='尚未設定';notify('API Key 已從這個瀏覽器清除。'); }
    catch { notify('無法清除 API Key。'); }
  };
  document.querySelector('#syncAllCharacters').onclick=event=>syncAllCharacters(event.currentTarget);
}

function formatSyncTime(value){
  if(!value) return '尚未同步';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?String(value):date.toLocaleString('zh-TW',{hour12:false});
}
function equipmentLabel(item){
  const labels=[];
  if(item.starforce) labels.push(`${item.starforce}★`);
  if(item.potentialGrade) labels.push(item.potentialGrade);
  if(item.additionalPotentialGrade) labels.push(`附加 ${item.additionalPotentialGrade}`);
  return labels.join(' · ') || '—';
}
async function syncOneCharacter(characterId,button){
  const key=savedApiKey();
  if(!key){currentView='settings';currentCharacterId=null;render();notify('請先在設定貼上並儲存 NEXON API Key。');return false;}
  const character=data.characters.find(c=>c.id===characterId);
  if(!character){notify('找不到角色。');return false;}
  const original=button?.textContent;
  if(button){button.disabled=true;button.textContent='準備同步…';}
  try {
    const snapshot=await NexonSync.fetchCharacter(character.name,key,message=>{if(button)button.textContent=message;});
    commitData(NexonSync.apply(data,character.id,snapshot,localDate()));
    if(currentCharacterId===character.id) renderCharacterDetail(); else render();
    notify(`${snapshot.name || character.name} 已同步；手動資料與歷史紀錄均已保留。`);
    return true;
  } catch(error){notify(`同步失敗：${error.message}`);return false;}
  finally {if(button?.isConnected){button.disabled=false;button.textContent=original;}}
}
async function syncAllCharacters(button){
  if(!savedApiKey()){notify('請先貼上並儲存 NEXON API Key。');return;}
  const ids=activeCharacters().map(c=>c.id);let done=0;
  button.disabled=true;
  for(const id of ids){
    const character=data.characters.find(c=>c.id===id);
    button.textContent=`同步 ${done+1}/${ids.length}：${character?.name || ''}`;
    if(await syncOneCharacter(id,null)) done++;
  }
  renderSettings();notify(`已完成 ${done}/${ids.length} 隻角色同步。`);
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
let editingCrystalId=null;
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
  document.querySelector('#nexonQuickAdd').hidden=Boolean(c);
  document.querySelector('#characterDialogTitle').textContent=c?'編輯角色／更新戰力':'新增角色';
  document.querySelector('#saveCharacterBtn').textContent=c?'儲存變更':'新增';
  for(const name of ['name','job','level','currentPower','targetBoss','bestTime','notes']){
    if(c) form.elements.namedItem(name).value=c[name];
  }
  dialog.showModal();
}
async function createCharacterFromNexon(button){
  const error=document.querySelector('#formError');
  error.hidden=true;
  const name=String(form.elements.namedItem('name').value).trim();
  if(!name){error.textContent='請先輸入角色名稱。';error.hidden=false;form.elements.namedItem('name').focus();return;}
  const key=savedApiKey();
  if(!key){error.textContent='請先到「設定」儲存 NEXON API Key。';error.hidden=false;return;}
  const original=button.textContent;
  button.disabled=true;
  try {
    const snapshot=await NexonSync.fetchCharacter(name,key,message=>{button.textContent=message;});
    const id=crypto.randomUUID();
    commitData(NexonSync.create(data,snapshot,localDate(),id));
    dialog.close();currentCharacterId=id;currentView='character';characterTab='overview';render();
    notify(`${snapshot.name} 已從 NEXON 建立；接下來可設定目標 Boss 與通關時間。`);
  } catch(fetchError){error.textContent=fetchError.message;error.hidden=false;}
  finally {if(button.isConnected){button.disabled=false;button.textContent=original;}}
}
function openCrystal(row=null){
  if(storageProblem){notify(storageProblem);return;}
  const available=data.characters.filter(c=>!c.archived||c.id===row?.characterId);
  if(!row && !available.length){notify('請先新增角色，再建立 Boss 紀錄。');return;}
  editingCrystalId=row?.id || null;crystalForm.reset();
  document.querySelector('#crystalFormError').hidden=true;
  document.querySelector('#crystalDialogTitle').textContent=row?'編輯結晶紀錄':'新增結晶紀錄';
  document.querySelector('#saveCrystalBtn').textContent=row?'儲存變更':'新增';
  const select=crystalForm.elements.namedItem('characterId');
  select.innerHTML=available.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  const linked=row && data.characters.some(c=>c.id===row.characterId);
  if(row && !linked){
    const option=document.createElement('option');option.value='__legacy__';option.textContent=`${row.character}（舊紀錄）`;select.prepend(option);
  }
  select.value=row ? (linked?row.characterId:'__legacy__') : (selectedBossCharacterId||available[0]?.id);
  crystalForm.elements.namedItem('cycle').value=row?.cycle==='monthly'?'monthly':'weekly';
  crystalForm.elements.namedItem('boss').value=row?.boss || '';
  crystalForm.elements.namedItem('weekStart').value=row?.weekStart || selectedCrystalWeek;
  crystalForm.elements.namedItem('income').value=row?.income ?? 0;
  crystalForm.elements.namedItem('done').checked=row?.done || false;
  crystalForm.elements.namedItem('notes').value=row?.notes || '';
  crystalDialog.showModal();
}
document.querySelectorAll('[data-close-character]').forEach(btn=>btn.onclick=()=>dialog.close());
document.querySelectorAll('[data-close-crystal]').forEach(btn=>btn.onclick=()=>crystalDialog.close());
document.querySelector('#addCharacterBtn').onclick=()=>openCharacter();
document.querySelector('#importCharacterBtn').onclick=event=>createCharacterFromNexon(event.currentTarget);
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
crystalForm.addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const fd=new FormData(crystalForm);
    const original=editingCrystalId ? data.crystalWeeks.find(row=>row.id===editingCrystalId) : null;
    const selectedId=String(fd.get('characterId'));
    const character=selectedId==='__legacy__' ? null : data.characters.find(c=>c.id===selectedId);
    if(!character && selectedId!=='__legacy__') throw new Error('請選擇有效角色。');
    if(selectedId==='__legacy__' && !original) throw new Error('找不到舊角色紀錄。');
    const weekStart=String(fd.get('weekStart'));
    const cycle=String(fd.get('cycle'))==='monthly'?'monthly':'weekly';
    const income=Number(fd.get('income'));
    const boss=String(fd.get('boss')).trim();
    if(!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error('請選擇週期起始日。');
    if(!boss) throw new Error('請填寫 Boss。');
    if(!Number.isSafeInteger(income) || income<0) throw new Error('收入必須是零以上的整數。');
    const row={
      id:editingCrystalId || crypto.randomUUID(),weekStart,week:cycle==='monthly'?`${weekStart.slice(0,7)} 月王`:weekLabel(weekStart),cycle,pricing:'manual',
      characterId:character?.id ?? original?.characterId,character:character?.name ?? original.character,
      boss,income,done:fd.get('done')==='on',notes:String(fd.get('notes')).trim()
    };
    if(row.characterId===undefined) delete row.characterId;
    const duplicate=data.crystalWeeks.some(existing=>existing.id!==editingCrystalId && crystalCycle(existing)===cycle && (cycle==='monthly'?existing.weekStart?.slice(0,7)===weekStart.slice(0,7):existing.weekStart===row.weekStart) &&
      (row.characterId ? existing.characterId===row.characterId : existing.character===row.character) && existing.boss.trim()===row.boss);
    if(duplicate) throw new Error('這個週期已經有相同角色與 Boss 的紀錄，請直接編輯原紀錄。');
    const next=structuredClone(data);
    if(editingCrystalId){
      const index=next.crystalWeeks.findIndex(x=>x.id===editingCrystalId);
      if(index<0) throw new Error('找不到這筆結晶紀錄，請重新整理。');
      next.crystalWeeks[index]=row;
    } else next.crystalWeeks.push(row);
    commitData(next);if(cycle==='monthly')selectedCrystalMonth=weekStart.slice(0,7);else selectedCrystalWeek=weekStart;selectedBossCharacterId=character?.id||selectedBossCharacterId;crystalDialog.close();renderCrystals();notify(editingCrystalId?'結晶紀錄已更新。':'Boss 紀錄已新增。');
  } catch(error){const el=document.querySelector('#crystalFormError');el.textContent=error.message;el.hidden=false;}
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
updateSyncCard();
if(storageProblem)notify(storageProblem);
