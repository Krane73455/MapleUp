/* Taiwan MapleStory boss crystal reference catalog used by the one-click ledger. */
(function(root){
  const PRICE_VERSION='TMS v282 · 2026-09-14';
  const rows=[
    ['hilla','希拉',[['hard','困難',6800000]]],['zakum','炎魔',[['chaos','混沌',7100000]]],
    ['pierre','比艾樂',[['chaos','混沌',7300000]]],['pinkbean','粉豆',[['chaos','混沌',7600000]]],
    ['queen','血腥皇后',[['chaos','混沌',7700000]]],['vonbon','斑斑',[['chaos','混沌',7700000]]],
    ['cygnus','西格諾斯',[['easy','簡單',5300000],['normal','普通',8700000]]],['magnus','梅格耐斯',[['hard','困難',8800000]]],
    ['vellum','貝倫',[['chaos','混沌',9000000]]],['princess','濃姬',[['normal','普通',18500000]]],
    ['papulatus','拉圖斯',[['chaos','混沌',20000000]]],['lotus','史烏',[['normal','普通',27000000],['hard','困難',91000000],['extreme','極限',324000000]]],
    ['damien','戴米安',[['normal','普通',29000000],['hard','困難',86000000]]],['slime','守護天使綠水靈',[['normal','普通',43000000],['chaos','混沌',127000000]]],
    ['lucid','露希妲',[['easy','簡單',54000000],['normal','普通',64000000],['hard','困難',102000000]]],['will','威爾',[['easy','簡單',57000000],['normal','普通',74000000],['hard','困難',127000000]]],
    ['dusk','戴斯克',[['normal','普通',80000000],['chaos','混沌',111000000]]],['darknell','頓凱爾',[['normal','普通',85000000],['hard','困難',126000000]]],
    ['verushilla','真希拉',[['normal','普通',124000000],['hard','困難',145000000]]],['marisia','瑪麗西亞',[['normal','普通',150000000],['extreme','極限',1500000000]]],
    ['seren','賽連',[['normal','普通',150000000],['hard','困難',272000000],['extreme','極限',724000000]]],['kalos','卡洛斯',[['easy','簡單',237000000],['normal','普通',309000000],['chaos','混沌',619000000],['extreme','極限',1237000000]]],
    ['adversary','最初的敵對者',[['easy','簡單',253000000],['normal','普通',371000000],['hard','困難',682000000],['extreme','極限',1344000000]]],['kaling','咖凌',[['easy','簡單',258000000],['normal','普通',362000000],['hard','困難',721000000],['extreme','極限',1443000000]]],
    ['badstar','凶星',[['normal','普通',355000000],['hard','困難',817000000]]],['limbo','林波',[['normal','普通',420000000],['hard','困難',749000000]]],
    ['baldrix','巴德利斯',[['normal','普通',560000000],['hard','困難',840000000]]],['jupiter','尤比太',[['normal','普通',705000000],['hard','困難',1368000000]]]
  ];
  const BOSSES=rows.flatMap(([group,name,variants])=>variants.map(([id,difficulty,price])=>({id:`${group}-${id}`,group,name,difficulty,price,cycle:'weekly'})));
  BOSSES.push({id:'blackmage-hard',group:'blackmage-hard',name:'黑魔法師',difficulty:'困難',price:991000000,cycle:'monthly'},
    {id:'blackmage-extreme',group:'blackmage-extreme',name:'黑魔法師',difficulty:'極限',price:3000000000,cycle:'monthly'});
  const normalize=value=>String(value||'').replace(/[\s・‧·．.（）()]/g,'').replaceAll('終極','極限').replaceAll('露西妲','露希妲').replaceAll('真希菈','真希拉').replaceAll('賽蓮','賽連').replaceAll('塞蓮','賽連');
  const getBoss=id=>BOSSES.find(b=>b.id===id);
  const bossLabel=b=>b.difficulty+b.name;
  const matchBoss=name=>BOSSES.find(b=>normalize(bossLabel(b))===normalize(name));
  const groupForRecord=row=>getBoss(row?.bossId)?.group || matchBoss(row?.boss)?.group || null;
  function crystalValue(basePrice,partySize=1){
    if(!Number.isSafeInteger(basePrice)||basePrice<0||!Number.isInteger(partySize)||partySize<1||partySize>6) throw new Error('結晶價格或隊伍人數無效。');
    return Math.floor(basePrice/partySize);
  }
  const priceSnapshot=(boss,partySize=1)=>({boss:bossLabel(boss),bossId:boss.id,cycle:boss.cycle,partySize,basePrice:boss.price,pricing:'catalog',priceVersion:PRICE_VERSION,income:crystalValue(boss.price,partySize)});
  const api={PRICE_VERSION,BOSSES,getBoss,bossLabel,matchBoss,groupForRecord,crystalValue,priceSnapshot};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BossCatalog=api;
})(typeof globalThis!=='undefined'?globalThis:this);
