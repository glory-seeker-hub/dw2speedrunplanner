const fs=require('node:fs'),{performance}=require('node:perf_hooks');
const {unit,load}=require('../tests/helpers/battleSupportFixtures.cjs');
const {simulateBattleCore}=load('src/utils/battleEngine.ts');
const {createSeededBattleRng}=load('src/utils/battle/battleRng.ts');
const {assistEligible}=load('src/utils/battle/battleSupportEffects.ts');
function fighter(name,ids,options={}){const a=unit(name,ids[0],options);a.techs=ids.map(id=>unit(name,id).techs[0]);return a;}
const scenarios={
 'heal-heavy':{player:[fighter('Healer',[0xbc,0xb5,0xcd,6],{currentHp:250}),fighter('Ally',[6],{currentHp:150})],enemy:[fighter('Enemy',[6],{stats:{hp:1500,atk:60}})]},
 'buff-debuff':{player:[fighter('Buffer',[0xc1,0xbd,0xbf,6]),fighter('Debuffer',[0x46,0x43,0xf7])],enemy:[fighter('Enemy',[6,0xf9],{stats:{hp:2000}})]},
 'status-powers':{player:[fighter('Power',[0xba,0xc0,0xd5,6]),fighter('Attack',[0x1f])],enemy:[fighter('Enemy',[6],{stats:{hp:2000}})]},
 'visibility-invincibility':{player:[fighter('Hidden',[0xd0,0xc5,6]),fighter('Attack',[0x1f])],enemy:[fighter('Enemy',[0xd0,0xc5,6],{stats:{hp:2000}})]},
 'support-interrupt':{player:[fighter('Support',[0xc3,0xb9,0xbc,6]),fighter('Attack',[0x46])],enemy:[fighter('Interrupt',[0xa1,0xa2],{stats:{hp:2000}})]},
};
const actionPolicy={chooseAction(actor,context){const skills=actor.skills.filter(s=>s.kind!=='assist'||assistEligible(actor,s,context.combatants));const skill=skills.length?skills[(context.round-1)%skills.length]:actor.skills[0];return {kind:'skill',skillKey:skill.key};}};
const rows=[];
for(const [scenario,input]of Object.entries(scenarios))for(const count of [1,100,1000]){
 let actions=0,records=0,draws=0,historyBytes=0,withoutSupportBytes=0;const outcomes={};const start=performance.now();
 for(let i=0;i<count;i++){
  const seeded=createSeededBattleRng(42+i);const rng={nextFloat:c=>{draws++;return seeded.nextFloat(c)},nextIntExclusive:(m,c)=>{draws++;return seeded.nextIntExclusive(m,c)},nextIntInclusive:(m,n,c)=>{draws++;return seeded.nextIntInclusive(m,n,c)}};
  const r=simulateBattleCore({...input,floorSpecialty:'Fire'},{rng,actionPolicy,maxRounds:20});actions+=r.actionCount;records+=r.actions.length;outcomes[r.outcome]=(outcomes[r.outcome]??0)+1;
  historyBytes+=Buffer.byteLength(JSON.stringify(r.actions));withoutSupportBytes+=Buffer.byteLength(JSON.stringify(r.actions,(k,v)=>['supportEvents','effectiveElement','invincibilityPreventedDamage','effectDiagnostics'].includes(k)?undefined:v));
 }
 rows.push({scenario,runs:count,wallMs:Number((performance.now()-start).toFixed(2)),averageActions:actions/count,averageRecords:records/count,averageRngDraws:draws/count,averageHistoryBytes:historyBytes/count,averageHistoryWithoutSupportAuditBytes:withoutSupportBytes/count,supportAuditBytesPerRun:(historyBytes-withoutSupportBytes)/count,outcomes});
 console.log(scenario+' '+count+': '+rows.at(-1).wallMs+'ms');
}
fs.writeFileSync('docs/phase-2k-h/performance.json',JSON.stringify({node:process.version,seed:'mulberry32-v1, 42 + run index',maxRounds:20,note:'Wall time includes history serialization; compare within this run, not as a cross-machine speed claim. Twenty-round support stress workloads intentionally include limit-reached outcomes.',rows},null,2)+'\n');
