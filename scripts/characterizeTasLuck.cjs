const fs=require('node:fs');
const {load,unit,input,sample,confusionBest,simulateBattleCore,createSeededBattleRng}=require('../tests/helpers/tasLuckFixtures.cjs');
const {BATTLE_SKILLS}=load('src/data/battleSkills.ts');
const {doubleInput,doublePolicy}=require('../tests/helpers/tasFixtures.cjs');
fs.mkdirSync('docs/phase-2k-l1',{recursive:true});
fs.writeFileSync('docs/phase-2k-l1/status-source-audit.json',JSON.stringify(BATTLE_SKILLS.filter(s=>s.effects.some(e=>e.kind==='status-application')).map(s=>({id:s.id,name:s.name,statusEffects:s.effects.filter(e=>e.kind==='status-application')})),null,2)+'\n');
const fixtures={
 'no-gates':input([unit('P',6,{stats:{atk:200}})],[unit('E',6,{stats:{hp:10}})]),
 'one-application':input([unit('P',105,{stats:{atk:200}})],[unit('E',6,{stats:{hp:10}})]),
 'repeated-paralysis':input([unit('P',105)],[unit('E',6,{stats:{hp:80}})]),
 'confusion-paralysis':confusionBest(),
 'double-e-stun':doubleInput(),
 'status-heavy':input([unit('P',105,{initialStatuses:{paralysis:true,confusion:true}})],[unit('E',105,{initialStatuses:{paralysis:true,confusion:true},stats:{hp:100}})]),
};
const results=[];
for(const [name,battle] of Object.entries(fixtures))for(const policy of ['natural','tas-luck']){
 const start=performance.now(),rollouts=3;let result,opportunities=0,branches=0,pruned=0,maxFrontier=0;
 const fixtureOptions={maxRounds:name==='double-e-stun'?60:name==='status-heavy'?10:5,...(name==='double-e-stun'?{actionPolicy:doublePolicy}:{})};
 for(let seed=0;seed<rollouts;seed++){
  if(policy==='natural')result=simulateBattleCore(battle,{rng:createSeededBattleRng(seed),...fixtureOptions,simulationRules:{accuracyMode:'strategy',rngPolicy:policy}});
  else {const s=sample(battle,seed,fixtureOptions);result=s.result;opportunities+=s.summary.opportunities;branches+=s.summary.branchesExplored;pruned+=s.summary.pruned;maxFrontier=Math.max(maxFrontier,s.summary.maxFrontier);}
 }
 const wallMs=performance.now()-start;results.push({name,policy,fairRollouts:rollouts,opportunities,branchesExplored:branches,pruned,maxFrontier,wallMs,fairRolloutsPerSecond:rollouts*1000/wallMs,internalBranchesPerSecond:policy==='tas-luck'?branches*1000/wallMs:null,resultBytes:Buffer.byteLength(JSON.stringify(result))});
 console.log(results.at(-1));
}
const {createOptimizedSearch}=load('src/utils/battle/battleOptimizedSearch.ts');
const presets=[];
for(const [preset,budget] of [['Quick',10000],['Standard',100000],['Deep',1000000]]){
 const start=performance.now(),search=createOptimizedSearch(fixtures['one-application'],budget,{seed:17,simulationRules:{accuracyMode:'strategy',rngPolicy:'tas-luck'}});let maxStepMs=0;
 while(!search.done){const t=performance.now();search.step();maxStepMs=Math.max(maxStepMs,performance.now()-t);}
 const wallMs=performance.now()-start,result=search.result('completed',wallMs);presets.push({preset,requestedBudget:budget,actualFairRollouts:result.search.completedSimulations,wallMs,maxStepMs,fairRolloutsPerSecond:result.search.completedSimulations*1000/wallMs,internalBranchesPerSecond:result.tasLuckSummary.branchesExplored*1000/wallMs,resultBytes:Buffer.byteLength(JSON.stringify(result)),...result.tasLuckSummary});
}
fs.writeFileSync('docs/phase-2k-l1/performance.json',JSON.stringify({notes:'Seeded local engine runs; branch throughput is internal replay work, not fair samples. Original practical double E-Stun maxRounds=60 with fixed Player targets; status-heavy=10; others=5. Engine cap=8. Preset jobs use default preset settings on a one-root fixture ending in round one, so finish after 64 fair samples; these are early-completion benchmarks, not full-budget stress runs.',results,presets},null,2)+'\n');
