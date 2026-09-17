const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');

test('new character flow only asks for the character name before NEXON import',()=>{
  assert.match(html,/name="name"/);
  assert.doesNotMatch(html,/name="job"|name="level"|name="currentPower"/);
  assert.match(app,/saveCharacterBtn'\)\.hidden=!c/);
});

test('equipment tab is API-backed and removes the unused manual analysis',()=>{
  assert.match(app,/裝備資訊/);
  assert.match(app,/NEXON 目前裝備/);
  assert.doesNotMatch(app,/手動裝備分析/);
});
