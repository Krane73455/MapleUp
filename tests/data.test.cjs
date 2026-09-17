const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../core.js');
const source = fs.readFileSync(require.resolve('../app.js'),'utf8');
const sandbox = {crypto:require('node:crypto').webcrypto};
vm.runInNewContext(source.slice(0,source.indexOf('const RECOVERY_KEY'))+';globalThis.seed=sampleData;',sandbox);
const seed = JSON.parse(JSON.stringify(sandbox.seed));
test('stop threshold and malformed times',()=>{
  for(const [time,result] of [['29:59',1799],['30:00',1800],['30:01',1801],['',null],['29:99',null],['00:00',null],['-1:00',null]]) assert.equal(core.seconds(time),result);
});
test('legacy data preserves equipment/history and links unique income records',()=>{
  const n=core.normalize(seed);
  assert.deepEqual(n.characters,seed.characters);
  assert.equal(n.crystalWeeks[0].characterId,seed.characters[0].id);
  assert.equal(n.crystalWeeks[0].boss,'未分類');
  assert.equal(n.crystalWeeks[0].weekStart,'2026-09-14');
  assert.ok(n.crystalWeeks[0].id);
  assert.equal(seed.crystalWeeks[0].characterId,undefined);
});
test('editing down/up preserves max and every changed value; metadata does not duplicate history',()=>{
  const c=seed.characters[0], count=c.powerHistory.length;
  let n=core.edit(seed,c.id,{...c,name:'改名',currentPower:100},'2026-09-17');
  assert.equal(n.characters[0].maxPower,23800000);
  assert.equal(n.characters[0].powerHistory.length,count+1);
  assert.equal(n.crystalWeeks[0].character,'改名');
  n=core.edit(n,c.id,{notes:'只有備註',currentPower:100,bestTime:'30:00'},'2026-09-17');
  assert.equal(n.characters[0].powerHistory.length,count+1);
  n=core.edit(n,c.id,{currentPower:30000000,bestTime:'29:59'},'2026-09-17');
  assert.equal(n.characters[0].maxPower,30000000);
  assert.deepEqual(n.characters[0].equipment,c.equipment);
});
test('backup round trip and raw legacy format',()=>{
  const n=core.normalize(seed);n.custom={preserve:true};
  assert.deepEqual(core.parseBackup(core.backup(n)),n);
  assert.deepEqual(core.parseBackup(JSON.stringify(seed)),core.normalize(seed));
});
test('reject wrong, corrupted, duplicate, nonfinite and future backups without mutation',()=>{
  const before=JSON.stringify(seed);
  for(const value of ['{','{}',JSON.stringify({format:'MapleUp',version:999,data:seed}),JSON.stringify({...seed,characters:[seed.characters[0],seed.characters[0]]}),JSON.stringify({...seed,settings:{stopUnderMinutes:0}}),JSON.stringify({...seed,crystalWeeks:[{week:'x',character:'x',income:-1,done:true}]})]) assert.throws(()=>core.parseBackup(value));
  assert.equal(JSON.stringify(seed),before);
});
test('unmatched or duplicate-name revenues remain intact',()=>{
  const s=structuredClone(seed);s.characters[1].name=s.characters[0].name;
  assert.equal(core.normalize(s).crystalWeeks[0].characterId,undefined);
  const n=core.normalize(seed);n.characters=[];
  assert.deepEqual(core.parseBackup(core.backup(n)).crystalWeeks,n.crystalWeeks);
});
test('crystal records preserve manual fields and reject duplicate ids',()=>{
  const n=core.normalize(seed);
  n.crystalWeeks[0].boss='困難史烏';n.crystalWeeks[0].income=123456789;n.crystalWeeks[0].done=true;n.crystalWeeks[0].notes='手動金額';
  const restored=core.parseBackup(core.backup(n));
  assert.deepEqual(restored.crystalWeeks[0],n.crystalWeeks[0]);
  restored.crystalWeeks.push({...restored.crystalWeeks[0]});
  assert.throws(()=>core.normalize(restored),/重複/);
});
test('catalog metadata and archived characters survive backup normalization',()=>{
  const n=core.normalize(seed);n.characters[0].archived=true;
  Object.assign(n.crystalWeeks[0],{cycle:'weekly',pricing:'catalog',bossId:'lotus-hard',partySize:2,basePrice:91000000});
  const restored=core.parseBackup(core.backup(n));
  assert.equal(restored.characters[0].archived,true);
  assert.equal(restored.crystalWeeks[0].bossId,'lotus-hard');
  assert.equal(restored.crystalWeeks[0].partySize,2);
  assert.equal(restored.crystalWeeks[0].income,n.crystalWeeks[0].income);
});
test('storage write failure keeps active data, destructive recovery precedes replacement',()=>{
  const values=new Map([['mapleup-v1',JSON.stringify(seed)]]);
  let fail=false;
  const context={...sandbox,MapleData:core,structuredClone,localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(fail && k==='mapleup-v1')throw Error('quota');values.set(k,v);}},document:{querySelector:()=>({}),querySelectorAll:()=>[]}};
  vm.createContext(context);
  vm.runInContext(source.slice(0,source.indexOf('document.querySelectorAll(".nav-btn").forEach(btn=>btn.onclick')),context);
  const before=vm.runInContext('JSON.stringify(data)',context);
  fail=true;
  assert.throws(()=>vm.runInContext('commitData({...data,characters:[]},{recovery:true})',context));
  assert.equal(vm.runInContext('JSON.stringify(data)',context),before);
  assert.equal(values.get('mapleup-v1'),JSON.stringify(seed));
  fail=false;
  vm.runInContext('commitData({...data,characters:[]},{recovery:true})',context);
  assert.equal(JSON.parse(values.get('mapleup-v1')).characters.length,0);
  assert.equal(values.get('mapleup-v1-recovery'),JSON.stringify(seed));
});
