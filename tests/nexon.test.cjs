const {test}=require('node:test');
const assert=require('node:assert/strict');
const nexon=require('../nexon.js');

test('distills Taiwan API data and finds combat power',()=>{
  const snapshot=nexon.distill('ocid',{character_name:'鳥鳥',character_class:'箭神',character_level:281,world_name:'殺人鯨',character_image:'https://example.test/a.png'},
    {final_stat:[{stat_name:'戰鬥力',stat_value:'12,345,678'},{stat_name:'BOSS傷害',stat_value:'400.00'}]},
    {item_equipment:[{item_equipment_slot:'武器',item_name:'測試弓',starforce:'22',potential_option_grade:'傳說'}]},'2026-09-17T00:00:00.000Z');
  assert.equal(snapshot.combatPower,12345678);
  assert.equal(snapshot.level,281);
  assert.deepEqual(snapshot.equipment[0],{slot:'武器',name:'測試弓',starforce:'22',potentialGrade:'傳說',additionalPotentialGrade:''});
});

test('sync preserves manual data and only appends changed power',()=>{
  const seed={characters:[{id:'c1',name:'舊名',job:'舊職業',level:280,currentPower:100,maxPower:200,targetBoss:'史烏',bestTime:'30:00',notes:'保留',stats:{手動:'保留'},equipment:[{slot:'武器',grade:'優先',note:'保留'}],powerHistory:[{date:'09/01',value:200}]}],crystalWeeks:[{id:'r1',characterId:'c1',character:'舊名',week:'x',income:123,done:true,boss:'史烏',notes:'手動金額'}],settings:{stopUnderMinutes:30}};
  const snapshot={name:'新名',job:'箭神',level:281,combatPower:150,syncedAt:'now',stats:[],equipment:[]};
  let next=nexon.apply(seed,'c1',snapshot,'2026-09-17');
  assert.equal(next.characters[0].currentPower,150);
  assert.equal(next.characters[0].maxPower,200);
  assert.equal(next.characters[0].powerHistory.length,2);
  assert.deepEqual(next.characters[0].stats,seed.characters[0].stats);
  assert.deepEqual(next.characters[0].equipment,seed.characters[0].equipment);
  assert.deepEqual(next.crystalWeeks[0],{...seed.crystalWeeks[0],character:'新名'});
  next=nexon.apply(next,'c1',snapshot,'2026-09-17');
  assert.equal(next.characters[0].powerHistory.length,2);
});

test('creates a fully synced character and rejects duplicate name or ocid',()=>{
  const seed={characters:[],crystalWeeks:[],settings:{stopUnderMinutes:30}};
  const snapshot={ocid:'ocid-1',name:'鳥鳥',job:'箭神',level:281,combatPower:12345678,syncedAt:'now',stats:[],equipment:[]};
  const next=nexon.create(seed,snapshot,'2026-09-17','c1');
  assert.equal(next.characters[0].name,'鳥鳥');
  assert.equal(next.characters[0].currentPower,12345678);
  assert.equal(next.characters[0].maxPower,12345678);
  assert.deepEqual(next.characters[0].powerHistory,[{date:'2026-09-17',value:12345678}]);
  assert.equal(next.characters[0].nexon.ocid,'ocid-1');
  assert.equal(seed.characters.length,0);
  assert.throws(()=>nexon.create(next,{...snapshot,ocid:'other'},'2026-09-17','c2'),/已在角色列表/);
  assert.throws(()=>nexon.create(next,{...snapshot,name:'新名字'},'2026-09-17','c2'),/已在角色列表/);
});
