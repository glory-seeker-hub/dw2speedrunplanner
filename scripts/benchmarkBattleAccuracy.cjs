const fs=require('node:fs');const {load}=require('../tests/helpers/loadTs.cjs');const {cases,member,tech}=require('../tests/helpers/battleFixtures.cjs');
const {simulateBattleCore}=load('src/utils/battleEngine.ts');const {createSeededBattleRng,createBattleRng}=load('src/utils/battle/battleRng.ts');const {BATTLE_SKILLS}=load('src/data/battleSkills.ts');
const statusHeavy=[[{...member('P',[tech('Brown Stinger'),tech('Stun Bubble')],{hp:150,spd:40}),initialStatuses:{poison:true,paralysis:true}}],[{...member('E',[tech('Stun Flame Shot'),tech('Evil Charm')],{hp:150,spd:30}),initialStatuses:{confusion:true}}]];
const output={};
for(const [name,[player,enemy]] of Object.entries({aoe:cases.aoe,statusHeavy})){
 output[name]=[1,100,1000].map(count=>{
  const base=createSeededBattleRng(42);const draws={};const rng=createBattleRng(()=>base.nextFloat(),category=>draws[category]=(draws[category]??0)+1);
  const outcomes={};let actions=0,records=0,firstRecordBytes=0;const start=performance.now();
  for(let i=0;i<count;i++){const r=simulateBattleCore({player,enemy,floorSpecialty:'None'},{rng,simulationIndex:i});actions+=r.actionCount;records+=r.actions.length;outcomes[r.outcome]=(outcomes[r.outcome]??0)+1;if(i===0)firstRecordBytes=Buffer.byteLength(JSON.stringify(r.actions));}
  return {count,ms:performance.now()-start,averageActionCount:actions/count,averageRecordCount:records/count,draws,totalDraws:Object.values(draws).reduce((a,b)=>a+b,0),firstHistoryBytes:firstRecordBytes,outcomes};
 });
}
fs.mkdirSync('docs/phase-2k-e',{recursive:true});fs.writeFileSync('docs/phase-2k-e/performance.json',JSON.stringify(output,null,2)+'\n');
const groups={cannotMiss:e=>e.kind==='accuracy-modifier'&&e.modifier==='cannot-miss',increasedAccuracy:e=>e.kind==='accuracy-modifier'&&e.modifier==='increased-accuracy',counterEvasion:e=>e.kind==='accuracy-modifier'&&e.modifier==='increased-evasion',conditionalAilments:e=>e.kind==='status-application'&&e.condition!=='always'};
const deferred=Object.fromEntries(Object.entries(groups).map(([key,test])=>[key,BATTLE_SKILLS.filter(s=>s.effects.some(test)).map(s=>({id:s.id,hex:'0x'+s.id.toString(16).toUpperCase().padStart(2,'0'),name:s.name,kind:s.actionKind,effects:s.effects.filter(test)}))]));
fs.writeFileSync('docs/phase-2k-e/deferred-effects.json',JSON.stringify(deferred,null,2)+'\n');console.log(JSON.stringify(output,null,2));
