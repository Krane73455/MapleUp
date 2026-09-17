/* NEXON Open API adapter. API keys are supplied at runtime and are never stored here. */
(function(root){
  const BASE_URL = 'https://open.api.nexon.com/maplestorytw/v1';
  const delay = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const text = value => typeof value === 'string' ? value : '';
  const integer = value => {
    const parsed = Number(String(value ?? '').replaceAll(',',''));
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
  };
  function apiMessage(status,payload){
    const code = payload?.error?.name || payload?.error?.code || '';
    if(code === 'OPENAPI00005') return 'API Key 無效，請到 NEXON Open API 重新複製。';
    if(status === 403) return '這組 API Key 沒有台版新楓之谷的存取權限。';
    if(status === 429) return 'NEXON API 呼叫次數已達上限，請稍後再試。';
    if(status === 503) return 'NEXON API 維護中，請稍後再試。';
    return payload?.error?.message || payload?.message || `NEXON API 回傳 HTTP ${status}`;
  }
  async function request(path,query,apiKey,fetchImpl=root.fetch){
    const url = new URL(BASE_URL + path);
    Object.entries(query).forEach(([key,value])=>url.searchParams.set(key,String(value)));
    for(let attempt=0;attempt<4;attempt++){
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(),30000);
      let response;
      try {
        response = await fetchImpl(url,{headers:{'x-nxopen-api-key':apiKey},mode:'cors',credentials:'omit',cache:'no-store',signal:controller.signal});
      } catch(error){
        if(error?.name === 'AbortError') throw new Error('NEXON API 連線逾時，請稍後重試。');
        throw new Error('無法連上 NEXON API，請檢查網路後再試。');
      } finally { clearTimeout(timeout); }
      let payload = null;
      try { payload = await response.json(); } catch {}
      if(response.status === 429 && attempt < 3){ await delay((attempt+1)*1500); continue; }
      if(!response.ok) throw new Error(apiMessage(response.status,payload));
      return payload;
    }
  }
  function findCombatPower(stats){
    const item = (stats?.final_stat || []).find(row=>{
      const name = text(row?.stat_name).toLowerCase().replaceAll(' ','');
      return name === '戰鬥力' || name === '战斗力' || name === 'combatpower';
    });
    return integer(item?.stat_value);
  }
  function distill(ocid,basic,stat,equipment,now=new Date().toISOString()){
    return {
      ocid:text(ocid),syncedAt:now,source:'NEXON Open API - MapleStoryTaiwan',
      characterImage:text(basic?.character_image),worldName:text(basic?.world_name),guildName:text(basic?.character_guild_name),
      name:text(basic?.character_name),job:text(basic?.character_class),level:integer(basic?.character_level),
      combatPower:findCombatPower(stat),
      stats:(stat?.final_stat || []).map(row=>({name:text(row?.stat_name),value:text(row?.stat_value)})).filter(row=>row.name),
      equipment:(equipment?.item_equipment || []).map(item=>({
        slot:text(item?.item_equipment_slot),name:text(item?.item_name),starforce:text(item?.starforce),
        potentialGrade:text(item?.potential_option_grade),additionalPotentialGrade:text(item?.additional_potential_option_grade)
      })).filter(item=>item.slot || item.name)
    };
  }
  async function fetchCharacter(characterName,apiKey,onProgress=()=>{},fetchImpl=root.fetch){
    if(!text(characterName).trim()) throw new Error('請先輸入角色名稱。');
    if(!text(apiKey).trim()) throw new Error('請先到設定儲存 NEXON API Key。');
    onProgress('查詢角色識別資料…');
    const id = await request('/id',{character_name:characterName.trim()},apiKey.trim(),fetchImpl);
    if(!id?.ocid) throw new Error('找不到角色，請確認角色名稱。');
    onProgress('讀取角色基本資料…');
    const basic = await request('/character/basic',{ocid:id.ocid},apiKey.trim(),fetchImpl);
    onProgress('讀取角色能力值…');
    const stat = await request('/character/stat',{ocid:id.ocid},apiKey.trim(),fetchImpl);
    onProgress('讀取裝備資料…');
    const equipment = await request('/character/item-equipment',{ocid:id.ocid},apiKey.trim(),fetchImpl);
    return distill(id.ocid,basic,stat,equipment);
  }
  function apply(data,characterId,snapshot,date){
    const next = JSON.parse(JSON.stringify(data));
    const c = next.characters.find(row=>row.id===characterId);
    if(!c) throw new Error('找不到角色，請重新開啟角色頁。');
    const oldName = c.name;
    if(snapshot.name) c.name = snapshot.name;
    if(snapshot.job) c.job = snapshot.job;
    if(Number.isSafeInteger(snapshot.level) && snapshot.level > 0) c.level = snapshot.level;
    if(Number.isSafeInteger(snapshot.combatPower) && snapshot.combatPower >= 0 && snapshot.combatPower !== c.currentPower){
      c.currentPower = snapshot.combatPower;
      c.powerHistory ||= [];
      c.powerHistory.push({date,value:snapshot.combatPower});
      c.maxPower = Math.max(c.maxPower || 0,snapshot.combatPower);
    }
    c.nexon = snapshot;
    if(c.name !== oldName){
      for(const row of next.crystalWeeks){ if(row.characterId===c.id) row.character=c.name; }
    }
    return next;
  }
  function create(data,snapshot,date,id){
    const name=text(snapshot?.name).trim();
    const job=text(snapshot?.job).trim();
    const level=snapshot?.level;
    if(!name || !job || !Number.isSafeInteger(level) || level < 1) throw new Error('NEXON 回傳的角色資料不完整，請稍後再試。');
    const duplicate=data.characters.find(character=>
      (snapshot.ocid && character.nexon?.ocid === snapshot.ocid) || character.name.trim().toLowerCase() === name.toLowerCase()
    );
    if(duplicate) throw new Error(`「${duplicate.name}」已在角色列表中，請開啟該角色後使用 NEXON 同步。`);
    const combatPower=Number.isSafeInteger(snapshot.combatPower) && snapshot.combatPower >= 0 ? snapshot.combatPower : 0;
    const next=JSON.parse(JSON.stringify(data));
    next.characters.push({
      id,name,job,level,currentPower:combatPower,maxPower:combatPower,targetBoss:'',bestTime:'',notes:'',
      stats:{'主屬性':'-','Boss 傷害':'-','無視防禦':'-','ARC':'-','AUT':'-'},equipment:[],
      powerHistory:combatPower?[{date,value:combatPower}]:[],nexon:snapshot
    });
    return next;
  }
  const api = {BASE_URL,request,findCombatPower,distill,fetchCharacter,apply,create};
  if(typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.NexonSync=api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
