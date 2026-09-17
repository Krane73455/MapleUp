const {test}=require('node:test');
const assert=require('node:assert/strict');
const nexon=require('../nexon.js');

test('distills Taiwan API data and finds combat power',()=>{
  const snapshot=nexon.distill('ocid',{character_name:'鳥鳥',character_class:'箭神',character_level:281,world_name:'殺人鯨',character_image:'https://example.test/a.png',character_gender:'女',character_date_create:'2020-01-02T00:00+08:00',character_exp_rate:'37.5'},
    {final_stat:[{stat_name:'戰鬥力',stat_value:'12,345,678'},{stat_name:'BOSS傷害',stat_value:'400.00'}]},
    {item_equipment:[{item_equipment_slot:'武器',item_name:'測試弓',starforce:'22',potential_option_grade:'傳說'}]},'2026-09-17T00:00:00.000Z');
  assert.equal(snapshot.combatPower,12345678);
  assert.equal(snapshot.level,281);
  assert.equal(snapshot.gender,'女');
  assert.equal(snapshot.createdAt,'2020-01-02T00:00+08:00');
  assert.equal(snapshot.experienceRate,'37.5');
  assert.deepEqual(snapshot.equipment[0],{slot:'武器',name:'測試弓',starforce:'22',icon:'',potentialGrade:'傳說',additionalPotentialGrade:'',potentials:[],additionalPotentials:[]});
});

test('distills Yellow Bird House summary and attribute panels',()=>{
  const snapshot=nexon.distill('ocid',{character_name:'鳥鳥',character_class:'箭神',character_level:281},{final_stat:[]},{item_equipment:[]},{
    union:{union_level:10368,union_artifact_level:52},dojang:{dojang_best_floor:70},
    hyperStat:{use_preset_no:1,hyper_stat_preset_1:[{stat_type:'傷害',stat_level:10,stat_increase:'30%'}]},
    ability:{preset_no:1,remain_fame:123,ability_preset_1:{ability_preset_grade:'傳說',ability_info:[{ability_no:1,ability_grade:'傳說',ability_value:'BOSS 傷害 +20%'}]}}
  });
  assert.equal(snapshot.unionLevel,10368);
  assert.equal(snapshot.artifactLevel,52);
  assert.equal(snapshot.dojangFloor,70);
  assert.deepEqual(snapshot.hyperStats,[{name:'傷害',level:10,effect:'30%'}]);
  assert.equal(snapshot.ability.presets[0].rows[0].effect,'BOSS 傷害 +20%');
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
