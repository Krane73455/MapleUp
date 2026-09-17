const {test}=require('node:test');
const assert=require('node:assert/strict');
const catalog=require('../boss-catalog.js');

test('catalog contains weekly and monthly choices with exact party split',()=>{
  assert.equal(catalog.BOSSES.filter(b=>b.cycle==='weekly').length,56);
  assert.equal(catalog.BOSSES.filter(b=>b.cycle==='monthly').length,2);
  const hardLotus=catalog.getBoss('lotus-hard');
  assert.equal(catalog.bossLabel(hardLotus),'困難史烏');
  assert.equal(catalog.crystalValue(hardLotus.price,3),30333333);
  assert.throws(()=>catalog.crystalValue(hardLotus.price,0));
});

test('price snapshots and aliases preserve catalog metadata',()=>{
  const boss=catalog.matchBoss('困難露西妲');
  assert.equal(boss.id,'lucid-hard');
  assert.deepEqual(catalog.priceSnapshot(boss,2),{
    boss:'困難露希妲',bossId:'lucid-hard',cycle:'weekly',partySize:2,basePrice:102000000,
    pricing:'catalog',priceVersion:catalog.PRICE_VERSION,income:51000000
  });
  assert.equal(catalog.groupForRecord({boss:'困難露西妲'}),'lucid');
});
