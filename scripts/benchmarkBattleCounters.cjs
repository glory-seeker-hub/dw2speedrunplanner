const fs=require('node:fs');
const {load}=require('../tests/helpers/loadTs.cjs');
const {cases,member,tech}=require('../tests/helpers/battleFixtures.cjs');
const {simulateBattleCore}=load('src/utils/battleEngine.ts');
const {createSeededBattleRng,createBattleRng}=load('src/utils/battle/battleRng.ts');
const scenarios={singleCounter:cases.counter,multiCounterAoe:[[member('Attacker',[tech('Triple Forces')],{hp:150,spd:40})],['Beast King Fist','Smiley Warhead','Pummel Whack'].map((s,i)=>member(`Counter ${i+1}`,[tech(s)],{hp:150,spd:20+i*10}))],tailBlade:[[member('Attacker',[tech('Rock Fist')],{hp:150,spd:40})],[member('Tail Blade user',[tech('Tail Blade')],{hp:150,spd:20})]]};
const output={};
for(const [name,[player,enemy]] of Object.entries(scenarios)) output[name]=[1,100,1000].map(count=>{
 const base=createSeededBattleRng(42),draws={},rng=createBattleRng(()=>base.nextFloat(),c=>draws[c]=(draws[c]??0)+1);
 let actions=0,records=0,firstHistoryBytes=0,firstHistoryWithoutCounterAuditBytes=0;const outcomes={},start=performance.now();
 for(let i=0;i<count;i++){
  const r=simulateBattleCore({player,enemy,floorSpecialty:'None'},{rng,simulationIndex:i});actions+=r.actionCount;records+=r.actions.length;outcomes[r.outcome]=(outcomes[r.outcome]??0)+1;
  if(!i){firstHistoryBytes=Buffer.byteLength(JSON.stringify(r.actions));firstHistoryWithoutCounterAuditBytes=Buffer.byteLength(JSON.stringify(r.actions.map(({counter,...a})=>a)));}
 }
 return {count,wallClockMs:performance.now()-start,averageExecutedActions:actions/count,averageRecords:records/count,totalRngDraws:Object.values(draws).reduce((a,b)=>a+b,0),draws,firstHistoryBytes,firstHistoryWithoutCounterAuditBytes,outcomes};
});
fs.mkdirSync('docs/phase-2k-f',{recursive:true});fs.writeFileSync('docs/phase-2k-f/performance.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
