/* Shared data rules; no browser or network dependencies. */
(function(root){
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const number = x => Number.isSafeInteger(x) && x >= 0;
  const text = x => typeof x === 'string';
  function seconds(value){
    if(!text(value) || !/^\d+:[0-5]\d$/.test(value)) return null;
    const [m,s] = value.split(':').map(Number);
    const result = m * 60 + s;
    return Number.isSafeInteger(result) && result > 0 ? result : null;
  }
  function validate(input){
    if(!object(input) || !Array.isArray(input.characters) || !Array.isArray(input.crystalWeeks) ||
       !object(input.settings) || !Number.isFinite(input.settings.stopUnderMinutes) || input.settings.stopUnderMinutes <= 0 || input.settings.stopUnderMinutes > 1440)
      throw new Error('不是有效的 MapleUp 資料：需要角色、結晶紀錄及停手設定。');
    const ids = new Set();
    for(const c of input.characters){
      if(!object(c) || !text(c.id) || !c.id || ids.has(c.id) || !text(c.name) || !c.name.trim() ||
         !text(c.job) || !c.job.trim() || !number(c.level) || c.level < 1 || !number(c.currentPower) || !number(c.maxPower) ||
         !text(c.targetBoss) || !text(c.bestTime) || !text(c.notes) ||
         (c.archived !== undefined && typeof c.archived !== 'boolean') ||
         (c.stats !== undefined && (!object(c.stats) || Object.values(c.stats).some(v=>!text(v) && !(typeof v === 'number' && Number.isFinite(v))))) ||
         (c.equipment !== undefined && (!Array.isArray(c.equipment) || c.equipment.some(e=>!object(e) || !text(e.slot) || !text(e.grade) || !text(e.note)))) ||
         (c.powerHistory !== undefined && (!Array.isArray(c.powerHistory) || c.powerHistory.some(h=>!object(h) || !text(h.date) || !number(h.value)))))
        throw new Error('角色資料格式不正確，或角色識別碼重複。原資料未變更。');
      ids.add(c.id);
    }
    const crystalIds = new Set();
    for(const row of input.crystalWeeks){
      if(!object(row) || !text(row.week) || !text(row.character) || !number(row.income) || typeof row.done !== 'boolean' ||
         (row.id !== undefined && (!text(row.id) || !row.id || crystalIds.has(row.id))) ||
         (row.characterId !== undefined && !text(row.characterId)) ||
         (row.boss !== undefined && !text(row.boss)) ||
         (row.weekStart !== undefined && (!text(row.weekStart) || !/^\d{4}-\d{2}-\d{2}$/.test(row.weekStart))) ||
         (row.notes !== undefined && !text(row.notes))) throw new Error('結晶紀錄格式不正確，或紀錄識別碼重複。原資料未變更。');
      if(row.cycle !== undefined && row.cycle !== 'weekly' && row.cycle !== 'monthly') throw new Error('結晶週期格式不正確。原資料未變更。');
      if(row.pricing !== undefined && row.pricing !== 'manual' && row.pricing !== 'catalog') throw new Error('結晶計價格式不正確。原資料未變更。');
      if(row.partySize !== undefined && (!Number.isInteger(row.partySize) || row.partySize<1 || row.partySize>6)) throw new Error('隊伍人數格式不正確。原資料未變更。');
      if(row.basePrice !== undefined && !number(row.basePrice)) throw new Error('結晶原價格式不正確。原資料未變更。');
      if(row.id !== undefined) crystalIds.add(row.id);
    }
    return input;
  }
  function normalize(input){
    const data = JSON.parse(JSON.stringify(validate(input)));
    for(const c of data.characters){
      c.powerHistory ||= [];
      c.equipment ||= [];
      c.stats ||= {};
      c.maxPower = c.powerHistory.reduce((max,h)=>Math.max(max,h.value),Math.max(c.maxPower,c.currentPower));
    }
    const usedCrystalIds = new Set(data.crystalWeeks.map(row=>row.id).filter(Boolean));
    for(const [index,row] of data.crystalWeeks.entries()){
      if(!row.id){
        let candidate = `legacy-crystal-${index}`;
        while(usedCrystalIds.has(candidate)) candidate += '-migrated';
        row.id = candidate;
        usedCrystalIds.add(candidate);
      }
      row.boss ||= '未分類';
      row.notes ||= '';
      row.cycle = row.cycle === 'monthly' ? 'monthly' : 'weekly';
      row.pricing ||= row.bossId ? 'catalog' : 'manual';
      if(!row.weekStart){
        const match = row.week.match(/^(\d{4})\/(\d{2})\/(\d{2})/);
        if(match) row.weekStart = `${match[1]}-${match[2]}-${match[3]}`;
      }
      const matches = data.characters.filter(c=>c.name === row.character);
      if(row.characterId === undefined && matches.length === 1) row.characterId = matches[0].id;
    }
    return data;
  }
  function parseBackup(raw){
    let value;
    try { value = JSON.parse(raw); } catch { throw new Error('檔案不是有效的 JSON。'); }
    if(object(value) && ('format' in value || 'version' in value || 'data' in value)){
      if(value.format !== 'MapleUp' || value.version !== 1) throw new Error('不支援此備份格式或版本。');
      value = value.data;
    }
    return normalize(value);
  }
  function backup(data){
    return JSON.stringify({format:'MapleUp',version:1,exportedAt:new Date().toISOString(),data:validate(data)},null,2);
  }
  function edit(data,id,fields,date){
    const next = normalize(data);
    const c = next.characters.find(c=>c.id === id);
    if(!c) throw new Error('找不到角色，請重新開啟角色頁。');
    if(fields.bestTime && seconds(fields.bestTime) === null) throw new Error('請輸入有效時間，例如 28:42；秒數需為 00–59，總時間須大於零。');
    if(c.currentPower !== fields.currentPower) c.powerHistory.push({date,value:fields.currentPower});
    for(const key of ['name','job','level','currentPower','targetBoss','bestTime','notes'])
      if(Object.hasOwn(fields,key)) c[key] = fields[key];
    c.maxPower = Math.max(c.maxPower,c.currentPower);
    for(const row of next.crystalWeeks) if(row.characterId === id) row.character = c.name;
    return normalize(next);
  }
  const api = {seconds,validate,normalize,parseBackup,backup,edit};
  if(typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MapleData = api;
})(globalThis);
